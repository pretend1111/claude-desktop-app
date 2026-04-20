import { useEffect, useMemo, useRef, useState } from 'react';
import './GooeyNav.css';

const defaultColors = [1, 2, 3, 1, 2, 3, 1, 4];

const noise = (n = 1) => n / 2 - Math.random() * n;

const getXY = (distance, pointIndex, totalPoints) => {
  const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
  return [distance * Math.cos(angle), distance * Math.sin(angle)];
};

const createParticle = (i, t, d, r, particleCount, colors) => {
  const rotate = noise(r / 10);

  return {
    start: getXY(d[0], particleCount - i, particleCount),
    end: getXY(d[1] + noise(7), particleCount - i, particleCount),
    time: t,
    scale: 1 + noise(0.2),
    color: colors[Math.floor(Math.random() * colors.length)],
    rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10,
  };
};

const applyFrame = (element, frame, immediate = false) => {
  if (!element || !frame) return;

  if (immediate) {
    element.classList.add('is-immediate');
  } else {
    element.classList.remove('is-immediate');
  }

  element.style.left = `${frame.left}px`;
  element.style.top = `${frame.top}px`;
  element.style.width = `${frame.width}px`;
  element.style.height = `${frame.height}px`;

  if (frame.radius != null) {
    element.style.borderRadius = `${frame.radius}px`;
  }

  if (frame.opacity != null) {
    element.style.opacity = `${frame.opacity}`;
  }

  if (immediate) {
    requestAnimationFrame(() => {
      element.classList.remove('is-immediate');
    });
  }
};

export default function GooeyNav({
  items,
  animationTime = 600,
  particleCount = 15,
  particleDistances = [90, 10],
  particleR = 100,
  timeVariance = 300,
  colors = defaultColors,
  initialActiveIndex = 0,
  activeKey,
  className = '',
  onItemSelect,
}) {
  const containerRef = useRef(null);
  const navRef = useRef(null);
  const filterRef = useRef(null);
  const textRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);

  const resolvedActiveIndex = useMemo(() => {
    if (activeKey == null) return activeIndex;
    const found = items.findIndex((item) => item.key === activeKey);
    return found >= 0 ? found : initialActiveIndex;
  }, [activeIndex, activeKey, initialActiveIndex, items]);

  useEffect(() => {
    if (activeKey == null) return;
    const found = items.findIndex((item) => item.key === activeKey);
    if (found >= 0) setActiveIndex(found);
  }, [activeKey, items]);

  const clearParticles = () => {
    if (!filterRef.current) return;
    const particles = filterRef.current.querySelectorAll('.particle');
    particles.forEach((particle) => {
      try {
        filterRef.current.removeChild(particle);
      } catch {
        // noop
      }
    });
  };

  const makeParticles = () => {
    if (!filterRef.current) return;
    const d = particleDistances;
    const r = particleR;
    const bubbleTime = animationTime * 2 + timeVariance;
    filterRef.current.style.setProperty('--time', `${bubbleTime}ms`);

    for (let i = 0; i < particleCount; i += 1) {
      const t = animationTime * 2 + noise(timeVariance * 2);
      const particleMeta = createParticle(i, t, d, r, particleCount, colors);
      filterRef.current.classList.remove('active');

      window.setTimeout(() => {
        if (!filterRef.current) return;

        const particle = document.createElement('span');
        const point = document.createElement('span');
        particle.classList.add('particle');
        particle.style.setProperty('--start-x', `${particleMeta.start[0]}px`);
        particle.style.setProperty('--start-y', `${particleMeta.start[1]}px`);
        particle.style.setProperty('--end-x', `${particleMeta.end[0]}px`);
        particle.style.setProperty('--end-y', `${particleMeta.end[1]}px`);
        particle.style.setProperty('--time', `${particleMeta.time}ms`);
        particle.style.setProperty('--scale', `${particleMeta.scale}`);
        particle.style.setProperty('--color', `var(--gooey-color-${particleMeta.color}, #f3f4f1)`);
        particle.style.setProperty('--rotate', `${particleMeta.rotate}deg`);

        point.classList.add('point');
        particle.appendChild(point);
        filterRef.current.appendChild(particle);

        requestAnimationFrame(() => {
          filterRef.current?.classList.add('active');
        });

        window.setTimeout(() => {
          try {
            filterRef.current?.removeChild(particle);
          } catch {
            // noop
          }
        }, t);
      }, 30);
    }
  };

  const updateEffectPosition = (element, item, immediate = false) => {
    if (!containerRef.current || !filterRef.current || !textRef.current || !element) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const itemRect = element.getBoundingClientRect();
    const bubbleFrame = item.bubble ?? {
      left: itemRect.x - containerRect.x,
      top: itemRect.y - containerRect.y,
      width: itemRect.width,
      height: itemRect.height,
      radius: itemRect.height / 2,
      opacity: 1,
    };

    applyFrame(filterRef.current, bubbleFrame, immediate);

    if (item.labelFrame) {
      textRef.current.innerText = item.label;
      applyFrame(
        textRef.current,
        {
          left: bubbleFrame.left + item.labelFrame.left,
          top: bubbleFrame.top + item.labelFrame.top,
          width: item.labelFrame.width,
          height: item.labelFrame.height ?? 20,
          opacity: 1,
        },
        immediate
      );
    } else {
      textRef.current.innerText = '';
      applyFrame(
        textRef.current,
        {
          left: bubbleFrame.left,
          top: bubbleFrame.top,
          width: bubbleFrame.width,
          height: bubbleFrame.height,
          opacity: 0,
        },
        immediate
      );
    }
  };

  const handleSelect = (event, index) => {
    const item = items[index];
    if (!item || item.disabled || resolvedActiveIndex === index) return;

    const buttonEl = event.currentTarget;
    setActiveIndex(index);
    updateEffectPosition(buttonEl, item);
    clearParticles();

    if (textRef.current) {
      textRef.current.classList.remove('active');
      void textRef.current.offsetWidth;
      textRef.current.classList.add('active');
    }

    makeParticles();

    const callback = onItemSelect ?? item.onSelect;
    if (typeof callback === 'function') {
      window.setTimeout(() => {
        callback(item);
      }, item.deferMs ?? 170);
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleSelect(event, index);
  };

  useEffect(() => {
    if (!navRef.current || !containerRef.current) return;
    const activeButton = navRef.current.querySelectorAll('[data-gooey-nav-item]')[resolvedActiveIndex];
    const activeItem = items[resolvedActiveIndex];
    if (activeButton && activeItem) {
      updateEffectPosition(activeButton, activeItem, true);
      textRef.current?.classList.add('active');
    }

    const resizeObserver = new ResizeObserver(() => {
      const currentButton = navRef.current?.querySelectorAll('[data-gooey-nav-item]')[resolvedActiveIndex];
      const currentItem = items[resolvedActiveIndex];
      if (currentButton && currentItem) {
        updateEffectPosition(currentButton, currentItem, true);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [items, resolvedActiveIndex]);

  return (
    <div className={`gooey-nav-container ${className}`} ref={containerRef}>
      <nav className="gooey-nav-nav">
        <div className="gooey-nav-items" ref={navRef}>
          {items.map((item, index) => {
            const isActive = index === resolvedActiveIndex;
            return (
              <button
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={`gooey-nav-item ${isActive ? 'active' : ''}`}
                data-gooey-nav-item
                disabled={item.disabled}
                key={item.key ?? `${item.label}-${index}`}
                onClick={(event) => handleSelect(event, index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                style={{
                  left: `${item.frame.left}px`,
                  top: `${item.frame.top}px`,
                  width: `${item.frame.width}px`,
                  height: `${item.frame.height}px`,
                }}
                type="button"
              >
                <img
                  alt=""
                  className="gooey-nav-icon"
                  src={item.icon}
                  style={{
                    left: `${item.iconFrame.left}px`,
                    top: `${item.iconFrame.top}px`,
                    width: `${item.iconFrame.width}px`,
                    height: `${item.iconFrame.height}px`,
                    opacity: isActive ? item.activeIconOpacity ?? item.iconOpacity ?? 1 : item.iconOpacity ?? 1,
                  }}
                />
              </button>
            );
          })}
        </div>
      </nav>
      <span className="effect filter" ref={filterRef} />
      <span className="effect text" ref={textRef} />
    </div>
  );
}
