import type { PropsWithChildren, ReactElement } from "react";

interface SectionPanelProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  delayMs?: number;
  actions?: ReactElement;
}

export const SectionPanel = ({
  title,
  subtitle,
  children,
  delayMs = 0,
  actions
}: SectionPanelProps): ReactElement => {
  return (
    <section
      className="section-panel slide-up"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <header className="section-panel-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      <div className="section-panel-body">{children}</div>
    </section>
  );
};
