import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL only auto-registers its cleanup when vitest globals are enabled;
// we keep globals off, so unmount between tests explicitly.
afterEach(cleanup);
