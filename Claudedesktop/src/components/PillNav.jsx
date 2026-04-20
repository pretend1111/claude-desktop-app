import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import './PillNav.css';

export default function PillNav({
  items,
  activeKey,
  className = '',
  onItemSelect,
  indicatorColor = '#f1efea',
  textColor = '#605e5a',
  activeTextColor = '#373734',
  height = 47,
  pillHeight = 39,
  gap = 6,
}) {
  const trackRef = useRef(null);
  const indicatorRef = useRef(null);
  const buttonRefs = useRef(new Map());
  const hasMountedRef = useRef(false);
  const [localActiveKey, setLocalActiveKey] = useState(activeKey ?? items.find((item) => !item.disabled)?.key);

  useLayoutEffect(() => {
    setLocalActiveKey(activeKey ?? items.find((item) => !item.disabled)?.key);
  }, [activeKey, items]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const indicator = indicatorRef.current;
    if (!track || !indicator) return;

    const placeIndicator = (immediate = false) => {
      const activeButton = buttonRefs.current.get(localActiveKey);
      if (!activeButton) {
        gsap.set(indicator, { opacity: 0 });
        return;
      }

      const trackRect = track.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      const top = Math.max(0, (height - pillHeight) / 2);

      gsap.to(indicator, {
        x: buttonRect.left - trackRect.left,
        y: top,
        width: buttonRect.width,
        height: pillHeight,
        opacity: 1,
        duration: immediate ? 0 : 0.26,
        ease: 'power3.out',
        overwrite: true,
      });
    };

    placeIndicator(!hasMountedRef.current);
    hasMountedRef.current = true;

    const resizeObserver = new ResizeObserver(() => {
      placeIndicator(true);
    });

    resizeObserver.observe(track);
    buttonRefs.current.forEach((button) => {
      resizeObserver.observe(button);
    });

    return () => resizeObserver.disconnect();
  }, [activeKey, height, items, localActiveKey, pillHeight]);

  const handleSelect = (item) => {
    if (item.disabled) return;
    setLocalActiveKey(item.key);

    const callback = onItemSelect ?? item.onSelect;
    if (typeof callback === 'function') {
      callback(item);
    }
  };

  return (
    <div
      className={`pill-nav-root ${className}`}
      style={{
        '--pill-active-text-color': activeTextColor,
        '--pill-gap': `${gap}px`,
        '--pill-height': `${pillHeight}px`,
        '--pill-indicator-bg': indicatorColor,
        '--pill-text-color': textColor,
        '--pill-track-height': `${height}px`,
      }}
    >
      <div className="pill-nav-track" ref={trackRef}>
        <span className="pill-nav-indicator" ref={indicatorRef} />
        {items.map((item) => {
          const isActive = item.key === localActiveKey;

          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.ariaLabel || item.label}
              className={`pill-nav-button ${isActive ? 'is-active' : ''}`}
              disabled={item.disabled}
              key={item.key}
              onClick={() => handleSelect(item)}
              ref={(element) => {
                if (element) {
                  buttonRefs.current.set(item.key, element);
                } else {
                  buttonRefs.current.delete(item.key);
                }
              }}
              style={{
                '--pill-label-max': `${item.labelMaxWidth ?? 64}px`,
              }}
              type="button"
            >
              <span className="pill-nav-icon-slot">
                <img
                  alt=""
                  className="pill-nav-icon"
                  height={item.iconHeight ?? 20}
                  src={item.icon}
                  style={{
                    height: `${item.iconHeight ?? 20}px`,
                    opacity: isActive ? (item.activeIconOpacity ?? 1) : (item.iconOpacity ?? 1),
                    width: `${item.iconWidth ?? 20}px`,
                  }}
                  width={item.iconWidth ?? 20}
                />
              </span>
              <span className="pill-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
