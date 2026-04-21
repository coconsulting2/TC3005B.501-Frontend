/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * MSW Node server used by the M1 component tests. Exposed as a single
 * instance so tests can call `server.use(...)` to override handlers.
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
