import {L1Verifier} from '@ensdomains/l1-verifier/contracts/L1Verifier.sol';
import '@ensdomains/ens-contracts/contracts/reverseRegistrar/L2ReverseResolver.sol';
import '@ensdomains/ens-contracts/contracts/resolvers/profiles/IVersionableResolver.sol';
// Storage slot
// ┌────────────────────┬───────────────────┬──────────────┬
// │      contract      │  state_variable   │ storage_slot │
// ├────────────────────┼───────────────────┼──────────────┼
// │ L2ReverseResolver  │       names       │      0       │
