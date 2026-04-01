import { createApiApp } from "./app.mjs";

const port = Number(process.env.BACKEND_PORT ?? process.env.PORT ?? "4000");
const host = process.env.BACKEND_HOST ?? "0.0.0.0";

const app = await createApiApp();

app.listen(port, host, () => {
  console.log(`app-vistoria-backend listening on ${host}:${port}`);
});
