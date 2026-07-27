import {
  LazyMotion,
  domMin,
  m,
  useAnimation,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  forwardRef,
  useImperativeHandle,
  type HTMLAttributes,
  type Ref,
} from "react";

export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface AnimatedIconProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "color" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
> {
  size?: number;
  duration?: number;
  color?: string;
}

interface IconFrameProps extends AnimatedIconProps {
  children: React.ReactNode;
}

const iconClassName = (className?: string) =>
  `inline-flex items-center justify-center${className ? ` ${className}` : ""}`;

const IconFrame = ({
  children,
  className,
  color,
  size = 24,
  style,
  ...props
}: IconFrameProps) => (
  <LazyMotion features={domMin} strict>
    <m.div
      className={iconClassName(className)}
      {...props}
      style={{ color, width: size, height: size, ...style }}
    >
      {children}
    </m.div>
  </LazyMotion>
);

const SvgFrame = ({ size, children }: { size: number; children: React.ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const useIconAnimation = (ref: Ref<AnimatedIconHandle>) => {
  const controls = useAnimation();
  const reducedMotion = useReducedMotion();

  useImperativeHandle(ref, () => ({
    startAnimation: () => {
      void controls.start(reducedMotion ? "normal" : "animate");
    },
    stopAnimation: () => {
      void controls.start("normal");
    },
  }), [controls, reducedMotion]);

  return controls;
};

export const GamepadIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, duration = 1, ...props }, ref) => {
    const controls = useIconAnimation(ref);
    const bodyVariants: Variants = {
      normal: { scale: 1 },
      animate: {
        scale: [1, 0.95, 1],
        transition: { duration: 0.5 * duration, ease: "easeInOut" },
      },
    };
    const controlVariants: Variants = {
      normal: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 0.85, 1],
        rotate: [0, 20, -20, 0],
        transition: { duration: 0.4 * duration, ease: "easeInOut" },
      },
    };

    return (
      <IconFrame size={size} {...props}>
        <SvgFrame size={size}>
          <m.path
            d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"
            variants={bodyVariants}
            initial="normal"
            animate={controls}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
          {[
            { x1: 6, x2: 10, y1: 11, y2: 11 },
            { x1: 8, x2: 8, y1: 9, y2: 13 },
            { x1: 15, x2: 15.01, y1: 12, y2: 12 },
            { x1: 18, x2: 18.01, y1: 10, y2: 10 },
          ].map((line, index) => (
            <m.line
              key={index}
              {...line}
              variants={controlVariants}
              initial="normal"
              animate={controls}
            />
          ))}
        </SvgFrame>
      </IconFrame>
    );
  },
);
GamepadIcon.displayName = "GamepadIcon";

export const LaptopIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, duration = 1, ...props }, ref) => {
    const controls = useIconAnimation(ref);
    const variants: Variants = {
      normal: {
        rotateX: 0,
        transformPerspective: 55,
        originX: "12px",
        originY: "15.526px",
      },
      animate: {
        rotateX: [72, -8, 3, 0],
        transformPerspective: 55,
        originX: "12px",
        originY: "15.526px",
        transition: {
          duration: 1.2 * duration,
          ease: [0.16, 1, 0.3, 1],
          times: [0, 0.6, 0.84, 1],
        },
      },
    };

    return (
      <IconFrame size={size} {...props}>
        <SvgFrame size={size}>
          <m.path
            d="M4 15.526V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8.526"
            variants={variants}
            initial="normal"
            animate={controls}
            style={{ transformBox: "view-box" }}
          />
          <path d="M20 15.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526" />
          <path d="M20.054 15.987H3.946" />
        </SvgFrame>
      </IconFrame>
    );
  },
);
LaptopIcon.displayName = "LaptopIcon";

export const StarIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, duration = 1, ...props }, ref) => {
    const controls = useIconAnimation(ref);
    const variants: Variants = {
      normal: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 1.2, 0.95, 1.05, 1],
        rotate: [0, -10, 10, 0],
        transition: { duration: 1.2 * duration, ease: "easeInOut" },
      },
    };

    return (
      <IconFrame size={size} {...props}>
        <m.svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={variants}
          initial="normal"
          animate={controls}
        >
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
        </m.svg>
      </IconFrame>
    );
  },
);
StarIcon.displayName = "StarIcon";

export const UsersIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, duration = 1, ...props }, ref) => {
    const controls = useIconAnimation(ref);
    const arcVariants: Variants = {
      normal: { strokeDashoffset: 0, opacity: 1 },
      animate: {
        strokeDashoffset: [50, 0],
        opacity: [0.3, 1],
        transition: { duration: 0.7 * duration, ease: "easeInOut" },
      },
    };
    const headVariants: Variants = {
      normal: { scale: 1, opacity: 1 },
      animate: {
        scale: [0.6, 1.2, 1],
        opacity: [0, 1],
        transition: { duration: 0.6 * duration, ease: "easeOut" },
      },
    };
    const sideVariants: Variants = {
      normal: { strokeDashoffset: 0, opacity: 0.8 },
      animate: {
        strokeDashoffset: [40, 0],
        opacity: [0.2, 1],
        transition: { duration: 0.7 * duration, ease: "easeInOut", delay: 0.3 },
      },
    };

    return (
      <IconFrame size={size} {...props}>
        <SvgFrame size={size}>
          <m.path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeDasharray="50" variants={arcVariants} initial="normal" animate={controls} />
          <m.path d="M16 3.128a4 4 0 0 1 0 7.744" strokeDasharray="40" variants={sideVariants} initial="normal" animate={controls} />
          <m.path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeDasharray="40" variants={sideVariants} initial="normal" animate={controls} />
          <m.circle cx="9" cy="7" r="4" variants={headVariants} initial="normal" animate={controls} />
        </SvgFrame>
      </IconFrame>
    );
  },
);
UsersIcon.displayName = "UsersIcon";

export const RadioIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, duration = 1, ...props }, ref) => {
    const controls = useIconAnimation(ref);
    const waveVariants = (delay: number): Variants => ({
      normal: { opacity: 1, scale: 1 },
      animate: {
        opacity: [0.2, 1, 0.2],
        scale: [0.92, 1.06, 0.92],
        transition: {
          duration: 1.2 * duration,
          ease: "easeInOut",
          repeat: Infinity,
          delay,
        },
      },
    });

    return (
      <IconFrame size={size} {...props}>
        <SvgFrame size={size}>
          <m.path d="M16.247 7.761a6 6 0 0 1 0 8.478" variants={waveVariants(0)} initial="normal" animate={controls} />
          <m.path d="M19.075 4.933a10 10 0 0 1 0 14.134" variants={waveVariants(0.16 * duration)} initial="normal" animate={controls} />
          <m.path d="M4.925 19.067a10 10 0 0 1 0-14.134" variants={waveVariants(0.16 * duration)} initial="normal" animate={controls} />
          <m.path d="M7.753 16.239a6 6 0 0 1 0-8.478" variants={waveVariants(0)} initial="normal" animate={controls} />
          <circle cx="12" cy="12" r="2" />
        </SvgFrame>
      </IconFrame>
    );
  },
);
RadioIcon.displayName = "RadioIcon";

export const UserIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, duration = 1, ...props }, ref) => {
    const controls = useIconAnimation(ref);
    const bodyVariants: Variants = {
      normal: { strokeDashoffset: 0, opacity: 1 },
      animate: {
        strokeDashoffset: [40, 0],
        opacity: [0.3, 1],
        transition: { duration: 0.6 * duration, ease: "easeInOut" },
      },
    };
    const headVariants: Variants = {
      normal: { scale: 1, opacity: 1 },
      animate: {
        scale: [0.6, 1.2, 1],
        opacity: [0, 1],
        transition: { duration: 0.5 * duration, ease: "easeOut", delay: 0.2 },
      },
    };

    return (
      <IconFrame size={size} {...props}>
        <SvgFrame size={size}>
          <m.path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" strokeDasharray="40" variants={bodyVariants} initial="normal" animate={controls} />
          <m.circle cx="12" cy="7" r="4" variants={headVariants} initial="normal" animate={controls} />
        </SvgFrame>
      </IconFrame>
    );
  },
);
UserIcon.displayName = "UserIcon";

export const SettingsIcon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
  ({ size = 24, duration = 1, ...props }, ref) => {
    const controls = useIconAnimation(ref);
    const gearVariants: Variants = {
      normal: { rotate: 0, scale: 1, y: 0 },
      animate: {
        rotate: [0, 16, 0],
        scale: [1, 1.06, 1],
        y: [0, -0.8, 0],
        transition: { duration: 0.9 * duration, ease: "easeInOut" },
      },
    };
    const sparkVariants = (delay: number): Variants => ({
      normal: { opacity: 0, scale: 0.6 },
      animate: {
        opacity: [0, 1, 0],
        scale: [0.6, 1.25, 1],
        transition: { duration: 0.35 * duration, ease: "easeOut", delay },
      },
    });
    const gearPath = "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915";

    return (
      <IconFrame size={size} {...props}>
        <SvgFrame size={size}>
          <m.g variants={gearVariants} initial="normal" animate={controls}>
            <path d={gearPath} />
            <circle cx="12" cy="12" r="3" />
            {[
              { cx: 12, cy: 4.6, r: 0.8, delay: 0.18 },
              { cx: 19, cy: 8, r: 0.7, delay: 0.26 },
              { cx: 18.5, cy: 16.5, r: 0.7, delay: 0.34 },
              { cx: 8, cy: 18, r: 0.7, delay: 0.42 },
              { cx: 5.5, cy: 9, r: 0.7, delay: 0.5 },
            ].map(({ delay, ...circle }) => (
              <m.circle
                key={delay}
                {...circle}
                fill="currentColor"
                variants={sparkVariants(delay)}
                initial="normal"
                animate={controls}
              />
            ))}
          </m.g>
        </SvgFrame>
      </IconFrame>
    );
  },
);
SettingsIcon.displayName = "SettingsIcon";
