"use client";
import { useEffect, useRef } from "react";

import { useParams, useRouter } from "next/navigation";

import { Video } from "../../components/Video/Video";
import styles from "./page.module.css";

import { Socket, io } from "socket.io-client";

const ICE_SERVERS = {
  iceServers: [
    {
      urls: "stun:openrelay.metered.ca:80",
    },
  ],
};

export default function Page(): JSX.Element {
  const router = useRouter();
  const roomId = useParams().roomId;
  const userVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerVideoRef = useRef<HTMLVideoElement | null>(null);
  const rtcConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket>();
  const userStreamRef = useRef<MediaStream | null>(null);
  const hostRef = useRef(false);

  const handleRoomCreated = () => {
    console.log("habdleRoomCreated");
    hostRef.current = true;
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 500, height: 500 },
      })
      .then((stream) => {
        /* use the stream */
        userStreamRef.current = stream;
        userVideoRef.current!.srcObject = stream;
        userVideoRef.current!.onloadedmetadata = () => {
          userVideoRef.current?.play();
        };
      })
      .catch((err: unknown) => {
        /* handle the error */
        console.log("handleRoomCreated", err);
      });
  };

  const handleRoomJoined = () => {
    console.log("handleRoomJoined");
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { width: 500, height: 500 },
      })
      .then((stream) => {
        /* use the stream */
        userStreamRef.current = stream;
        userVideoRef.current!.srcObject = stream;
        userVideoRef.current!.onloadedmetadata = () => {
          userVideoRef.current?.play();
        };
        socketRef.current?.emit("ready", roomId);
      })
      .catch((err) => {
        /* handle the error */
        console.log("error", err);
      });
  };

  const createPeerConnection = () => {
    console.log("createPeerConnection");
    // We create a RTC Peer Connection
    const connection = new RTCPeerConnection(ICE_SERVERS);

    // We implement our onicecandidate method for when we received a ICE candidate from the STUN server
    connection.onicecandidate = handleICECandidateEvent;

    // We implement our onTrack method for when we receive tracks
    connection.ontrack = handleTrackEvent;
    return connection;
  };

  const initiateCall = () => {
    if (hostRef.current) {
      rtcConnectionRef.current = createPeerConnection();
      const track0 = userStreamRef.current?.getTracks()[0];
      const track1 = userStreamRef.current?.getTracks()[1];
      if (track0 && track1 && userStreamRef.current) {
        rtcConnectionRef.current.addTrack(track0, userStreamRef.current);
        rtcConnectionRef.current.addTrack(track1, userStreamRef.current);
      }

      rtcConnectionRef.current
        .createOffer()
        .then((offer) => {
          rtcConnectionRef.current?.setLocalDescription(offer);
          socketRef.current?.emit("offer", offer, roomId);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  const onPeerLeave = () => {
    // This person is now the creator because they are the only person in the room.
    hostRef.current = true;
    if (peerVideoRef.current?.srcObject) {
      peerVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop()); // Stops receiving all track of Peer.
    }

    // Safely closes the existing connection established with the peer who left.
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }
  };

  const handleReceivedOffer = (offer: RTCSessionDescriptionInit) => {
    if (!hostRef.current) {
      rtcConnectionRef.current = createPeerConnection();
      const track0 = userStreamRef.current?.getTracks()[0];
      const track1 = userStreamRef.current?.getTracks()[1];
      if (track0 && track1 && userStreamRef.current) {
        rtcConnectionRef.current.addTrack(track0, userStreamRef.current);
        rtcConnectionRef.current.addTrack(track1, userStreamRef.current);
      }

      rtcConnectionRef.current.setRemoteDescription(offer);

      rtcConnectionRef.current
        .createAnswer()
        .then((answer) => {
          rtcConnectionRef.current?.setLocalDescription(answer);
          socketRef.current?.emit("answer", answer, roomId);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };
  const handleAnswer = (answer: RTCSessionDescriptionInit) => {
    rtcConnectionRef.current
      ?.setRemoteDescription(answer)
      .catch((err) => console.log(err));
  };

  const handleICECandidateEvent = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      socketRef.current?.emit("ice-candidate", event.candidate, roomId);
    }
  };

  const handlerNewIceCandidateMsg = (incoming: RTCIceCandidateInit) => {
    // We cast the incoming candidate to RTCIceCandidate
    const candidate = new RTCIceCandidate(incoming);
    rtcConnectionRef.current
      ?.addIceCandidate(candidate)
      .catch((e) => console.log(e));
  };

  const handleTrackEvent = (event: RTCTrackEvent) => {
    console.log("handeTrackEvent");
    if (peerVideoRef.current) {
      peerVideoRef.current.srcObject = event.streams[0] as MediaStream;
    }
  };

  useEffect(() => {
    socketRef.current = io("localhost:3001");
    // First we join a room
    socketRef.current?.emit("join", roomId);

    socketRef.current?.on("created", handleRoomCreated);

    socketRef.current?.on("joined", handleRoomJoined);
    // If the room didn't exist, the server would emit the room was 'created'

    // Whenever the next person joins, the server emits 'ready'
    socketRef.current?.on("ready", initiateCall);

    // Emitted when a peer leaves the room
    socketRef.current?.on("leave", onPeerLeave);

    // If the room is full, we show an alert
    socketRef.current?.on("full", () => {
      window.location.href = "/";
    });

    // Events that are webRTC specific
    socketRef.current?.on("offer", handleReceivedOffer);
    socketRef.current?.on("answer", handleAnswer);
    socketRef.current?.on("ice-candidate", handlerNewIceCandidateMsg);

    window.addEventListener("beforeunload", function () {
      socketRef.current?.emit("leave", roomId);
    });
    // clear up after
    return () => {
      // exitRoom();
      socketRef.current?.disconnect();
    };
  }, [roomId]);

  const exitRoom = () => {
    socketRef.current?.emit("leave", roomId); // Let's the server know that user has left the room.

    if (userVideoRef.current?.srcObject) {
      userVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop()); // Stops receiving all track of User.
    }
    if (peerVideoRef.current?.srcObject) {
      peerVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop()); // Stops receiving audio track of Peer.
    }

    // Checks if there is peer on the other side and safely closes the existing connection established with the peer.
    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.ontrack = null;
      rtcConnectionRef.current.onicecandidate = null;
      rtcConnectionRef.current.close();
      rtcConnectionRef.current = null;
    }

    router.push("/");
  };

  return (
    <main className={styles.main}>
      <Video ref={userVideoRef} />
      <Video ref={peerVideoRef} />
      <button onClick={exitRoom}>Exit</button>
    </main>
  );
}
