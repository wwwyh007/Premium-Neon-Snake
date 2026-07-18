import type { Metadata } from "next";
import { NeonSnakeGame } from "./NeonSnakeGame";

export const metadata: Metadata = {
  title: "Premium Neon Snake — Web Alpha",
  description:
    "A browser-native neon arcade game with classic and obstacle modes.",
};

export default function Home() {
  return <NeonSnakeGame />;
}
