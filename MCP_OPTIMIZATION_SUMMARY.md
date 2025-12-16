# Session Management Design Evolution Analysis

## 1. Abstraction Layer Value Analysis

The current architecture employs a "Thick Tool, Thin CLI" pattern.

*   **CLI Layer (`session.ts`)**: Acts primarily as a UI adapter. Its value lies in:
    *   **UX Enhancement**: formatting JSON outputs into human-readable text (colors, indentation).
    *   **Shortcuts**: providing semantic commands like `status` and `task` which map to generic `update` operations in the backend.
    *   **Safety**: specialized error handling (e.g., `EPIPE`) and user feedback.
*   **Tool Layer (`session-manager.ts`)**: Encapsulates the core business logic.
    *   **Centralized Security**: The `validatePathParams` and `findSession` functions ensure operations are confined to valid session scopes, preventing path traversal.
    *   **Path Routing**: The `PATH_ROUTES` constant abstracts the physical file structure away from the logical operations. Consumers request "plan" or "task", not specific file paths.
    *   **Polymorphism**: Handles both "Standard WFS" (heavy workflow) and "Lite" (ephemeral) sessions through a unified interface.

**Verdict**: The abstraction is high-value for **security** and **consistency**, ensuring that all session interactions (whether from CLI or Agent) adhere to the same structural invariants. However, the semantic mapping is thinning, with the CLI often just passing raw JSON `content` directly to the tool.

## 2. Hidden Complexity Costs

The "Unified Session Manager" design hides significant complexity that is beginning to leak:

*   **Discovery Overhead**: `findSession` performs a linear search across 4 distinct directory roots (`active`, `archived`, `lite-plan`, `lite-fix`) for *every single operation*. As the number of sessions grows, this disk I/O could become a bottleneck.
*   **Leaky Abstractions in Handling "Lite" Sessions**:
    *   `executeInit` contains explicit branching logic (`if (location === 'lite-plan'...)`).
    *   `executeArchive` explicitly throws errors for Lite sessions.
    *   The "Unified" interface creates a false promise of compatibility; consumers must "know" that `archive` doesn't work for Lite sessions, breaking the Liskov Substitution Principle.
*   **Routing Table Explosion**: `PATH_ROUTES` is becoming a "God Object" mapping. It mixes different domains:
    *   Core Workflow (`session`, `plan`)
    *   Task Management (`task`, `summary`)
    *   Review Systems (`review-dim`, `review-iter`)
    *   Lite System (`lite-plan`, `exploration`)
    *   *Cost*: Adding a new feature requires touching the Schema, the Routing Table, and often the Operation Switch.

## 3. Parameter Transformation Overhead

Data undergoes multiple transformations, creating friction:

1.  **CLI Args -> Options Object**: `args` parsed into `InitOptions`, `ReadOptions`.
2.  **Options -> Tool Params**: Specialized options (`options.taskId`) are manually mapped to generic `path_params`.
    *   *Risk*: The CLI must implicitly know which `content_type` requires which `path_params`. For example, `readAction` manually constructs `path_params` for `taskId`, `filename`, `dimension`, etc. If the Tool changes a required param, the CLI breaks.
3.  **Tool Params -> Zod Validation**: The tool re-validates the structure.
4.  **Tool -> File System**: The tool maps logical params to physical paths.

**High Friction Area**: The generic `path_params` object. It forces a loose contract. A strict type system (e.g., distinct interfaces for `ReadTaskParams` vs `ReadPlanParams`) is lost in favor of a generic `Record<string, string>`.

## 4. Alternative Architecture Proposals

### Proposal A: Domain-Specific Tools (Split by Lifecycle)
Split the monolithic `session_manager` into targeted tools.
*   **Components**: `wfs_manager` (Standard Workflow), `lite_session_manager` (Lite/Ephemeral).
*   **Pros**:
    *   Clean separation of concerns. `lite` tools don't need `archive` or `task` logic.
    *   Simpler Schemas.
    *   Faster discovery (look in 1 place).
*   **Cons**:
    *   Agent confusion: "Which tool do I use to read a file?"
    *   Duplicated utility code (file reading, writing).

### Proposal B: Resource-Oriented Architecture (REST-like)
Focus on Resources rather than Operations.
*   **Components**: `task_tool` (CRUD for tasks), `session_tool` (Lifecycle), `file_tool` (Safe FS access within session).
*   **Pros**:
    *   Aligns with how LLMs think (Action on Object).
    *   `task_tool` can enforce strict schemas for task status updates, removing the "magic string" status updates in the current CLI.
*   **Cons**:
    *   Loss of the "Session" as a coherent unit of work.
    *   Harder to implement "global" operations like `archive` which touch multiple resources.

### Proposal C: Strategy Pattern (Internal Refactor)
Keep the Unified Interface, but refactor internals.
*   **Design**: `SessionManager` class delegates to `SessionStrategy` implementations (`StandardStrategy`, `LiteStrategy`).
*   **Pros**:
    *   Removes `if (lite)` checks from main logic.
    *   Preserves the simple "one tool" interface for Agents.
    *   Allows `LiteStrategy` to throw "NotSupported" cleanly or handle `archive` differently (e.g., delete).
*   **Cons**:
    *   Does not solve the `path_params` loose typing issue.

## 5. Recommended Optimal Design

**Hybrid Approach: Strategy Pattern + Stronger Typing**

1.  **Refactor `session-manager.ts` to use a Strategy Pattern.**
    *   Define a `SessionStrategy` interface: `init`, `resolvePath`, `list`, `archive`.
    *   Implement `StandardWorkflowStrategy` and `LiteWorkflowStrategy`.
    *   The `handler` simply identifies the session type (via `findSession` or input param) and delegates.

2.  **Flatten the Path Resolution.**
    *   Instead of `path_params: { task_id: "1" }`, promote widely used IDs to top-level optional params in the Zod schema: `task_id?: string`, `filename?: string`. This makes the contract explicit to the LLM.

3.  **Deprecate "Hybrid" content types.**
    *   Instead of `content_type="lite-plan"`, just use `content_type="plan"` and let the `LiteStrategy` decide where that lives (`plan.json` vs `IMPL_PLAN.md`). This unifies the language the Agent uses—it always "reads the plan", regardless of session type.

**Benefit**: This maintains the ease of use for the Agent (one tool) while cleaning up the internal complexity and removing the "Leaky Abstractions" where the Agent currently has to know if it's in a Lite or Standard session to ask for the right file type.