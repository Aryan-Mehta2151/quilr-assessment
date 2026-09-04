import { startProvider } from "./provider-mock.js";

const name = process.argv[2] ?? "primary";
const port = Number(process.argv[3] ?? (name === "primary" ? 6000 : 6001));
startProvider(name, port);
