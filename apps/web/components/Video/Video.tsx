"use client";

import { forwardRef } from "react";
import styles from "./video.module.css";

export const Video = forwardRef<HTMLVideoElement>((props, ref) => {
  return (
    <video
      className={styles.videoPlayer}
      ref={ref}
      autoPlay
      playsInline
      muted
    />
  );
});
