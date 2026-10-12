import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: "/api/audit/generate",
      method: "POST",
    },
  ],
});
