/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Global setup for Vitest. Loads jest-dom matchers and resets the DOM
 * between tests to keep them isolated.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

afterEach(() => {
  cleanup();
});
