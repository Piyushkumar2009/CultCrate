/**
 * Decision rules for deleting an account. Pure (no HTTP / database), so the safety rules are unit-tested.
 *  - nobody can delete themselves,
 *  - the target must exist,
 *  - an admin must be demoted first (so an admin can never be removed by a single mis-click, and the
 *    caller, who is always an admin and never the target, guarantees at least one admin remains).
 */
export type DeleteDecision =
  | { allowed: true }
  | { allowed: false; code: 'not_allowed' | 'not_found'; message: string };

export function decideUserDelete(input: {
  callerId: string;
  targetId: string;
  targetExists: boolean;
  targetIsAdmin: boolean;
}): DeleteDecision {
  if (input.callerId === input.targetId) {
    return { allowed: false, code: 'not_allowed', message: "You can't delete your own account from the admin panel." };
  }
  if (!input.targetExists) {
    return { allowed: false, code: 'not_found', message: "We couldn't find that account." };
  }
  if (input.targetIsAdmin) {
    return { allowed: false, code: 'not_allowed', message: 'Remove their admin access first, then delete the account.' };
  }
  return { allowed: true };
}
