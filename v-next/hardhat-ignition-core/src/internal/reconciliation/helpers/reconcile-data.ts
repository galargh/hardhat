import type { SendDataFuture } from "../../../types/module";
import type { SendDataExecutionState } from "../../execution/types/execution-state";
import type {
  ReconciliationContext,
  ReconciliationFutureResultFailure,
} from "../types";

import { assertIgnitionInvariant } from "../../utils/assertions";
import { findResultForFutureById } from "../../views/find-result-for-future-by-id";

import { compare } from "./compare";

export function reconcileData(
  future: SendDataFuture,
  exState: SendDataExecutionState,
  context: ReconciliationContext,
): ReconciliationFutureResultFailure | undefined {
  if (typeof future.data === "string" || future.data === undefined) {
    return compare(future, "Data", exState.data, future.data ?? "0x");
  }

  const newData = findResultForFutureById(
    context.deploymentState,
    future.data.id,
  );

  assertIgnitionInvariant(
    typeof newData === "string",
    "Expected data to be a string",
  );

  return compare(future, "Data", exState.data, newData);
}
