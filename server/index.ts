import { config } from "./config";
import { app } from "./app";

app.listen(config.port, () => {
  console.log(`API ready on http://localhost:${config.port}`);
});
