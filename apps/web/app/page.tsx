"use client";

import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";
export default function Page(): JSX.Element {
  const router = useRouter();
  const createRoom = () => {
    router.push(`/${uuid()}`);
  };

  return (
    <>
      <button onClick={createRoom}>Start</button>
    </>
  );
}
