import youtubedl from "yt-dlp-exec";

const links = [
  "https://www.instagram.com/reel/DYUXCKrtuKo/?igsh=YTVubXc2cG14eGwx",
  "https://www.instagram.com/reel/DYwfnsmM9Ne/?igsh=MXBzaWZjNzhiZjdheg==",
];

async function downloadReels(links: string[]) {
  for (const link of links) {
    console.log("Downloading:", link);
    await youtubedl(link, {
      output: "./reels/%(title)s.%(ext)s",
      format: "mp4",
    });
  }
}

async function main() {
  console.log("Downloading reels...");
  await downloadReels(links);
}

main().catch(console.error);
