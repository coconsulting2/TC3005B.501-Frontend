/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Global setup for Vitest. Loads jest-dom matchers and resets the DOM
 * between tests to keep them isolated.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, afterAll, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./frontend/mocks/server";

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
