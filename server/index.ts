import { config } from "./config";
import { app } from "./app.ts";

app.listen(config.port, () => {
  console.log(`API ready on http://localhost:${config.port}`);
});
