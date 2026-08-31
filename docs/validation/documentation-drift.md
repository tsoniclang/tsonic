# Documentation drift policy

The documentation tree is a checked product surface.

## Mechanical gates

The documentation checker validates:

- required manual, reference, target, architecture, and validation pages;
- all relative Markdown links;
- navigation entries;
- shared project-config fields and defaults;
- neutral source primitive, type-marker, call-marker, pointer, safety, and
  attribute exports;
- symmetric C# and Rust target-reference structure;
- exact C# and Rust target option names;
- current target virtual-module prefixes;
- prohibited retired architecture terminology;
- support evidence paths where a committed matrix cites a proof.

## No hand-maintained counts

Documentation must not state a test, proof-project, file, or API count unless
that count is generated in the same verification run. A proof README therefore
says that its verifier derives the inventory; it does not hardcode a project
count that can drift.

## One authority

Canonical product documentation lives here. Sibling target, runtime, and
capability repositories retain only package summaries and local build/test
instructions linked to this tree. Historical `.analysis` packets are not
product documentation or current specifications.

## Change discipline

A source marker, target option, source profile, provider contract, capability
operation, output mode, or support disposition change is incomplete until its
canonical reference and executable evidence change in the same work item.
