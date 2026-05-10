interface LogoProps {
  size?: number;
  tag?: string;
}

export function Logo({ size = 22, tag = 'ALAMUT' }: LogoProps) {
  return (
    <span className="logo">
      <span className="logo-mark" style={{ fontSize: size }}>Alamut</span>
      <span className="logo-tag">{tag}</span>
    </span>
  );
}
