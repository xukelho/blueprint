type BlueprintLogoMarkProps = {
  className?: string;
};

export function BlueprintLogoMark({ className }: BlueprintLogoMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M24.5 24.5V475.5H475.5V24.5"
        stroke="currentColor"
        strokeWidth="10"
      />
      <path
        d="M24.5 239.5H300.5V475.5H24.5V239.5Z"
        stroke="currentColor"
        strokeWidth="6"
      />
      <path
        d="M24.5 24.5L475.5 475.5"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
