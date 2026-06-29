import React from 'react';

const SectionCard = React.forwardRef(({ id, title, description, action, children }, ref) => {
  return (
    <section
      id={id}
      ref={ref}
      className="rounded-[30px] border border-white/70 bg-surface-container-lowest p-6 soft-panel"
    >
      <div className="flex flex-col gap-3 border-b border-outline-variant/30 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-headline font-extrabold tracking-tight text-primary">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
              {description}
            </p>
          ) : null}
        </div>
        {action || null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
});

SectionCard.displayName = 'SectionCard';

export default SectionCard;
