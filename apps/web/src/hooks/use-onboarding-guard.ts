"use client";

/**
 * CENTAUR stub — no onboarding or auth required.
 * Always passes through immediately.
 */
export const useRequireOnboarding = () => {
  return { isLoading: false, isComplete: true };
};

export const useRedirectIfOnboarded = () => {
  return { isLoading: false, isComplete: true };
};
