import { defineConfig, type Plugin } from "vite";

// `vite build --mode crazygames` builds the CrazyGames bundle into
// dist-crazygames/: it drops the Rokumon hub bridge (an absolute path the
// portal does not serve), loads the CrazyGames SDK v3 and adds the portal's
// required body CSS. The default build is unchanged.
const crazyGamesHtml: Plugin = {
  name: "crazygames-html",
  transformIndexHtml: {
    order: "pre",
    handler: (html) => html
      .replace(/\s*<script src="\/hub-bridge\.js"><\/script>/, "")
      .replace(
        "  </head>",
        `    <style>body { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }</style>\n    <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n  </head>`,
      ),
  },
};

export default defineConfig(({ mode }) => mode === "crazygames"
  ? { base: "./", plugins: [crazyGamesHtml], build: { outDir: "dist-crazygames" } }
  : { base: "./" });
