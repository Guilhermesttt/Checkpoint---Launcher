"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import {
    CircleCheckIcon,
    InfoIcon,
    Loader2Icon,
    OctagonXIcon,
    TriangleAlertIcon,
    XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const toast = ToastPrimitive.createToastManager()

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
    return <ToastPrimitive.Provider {...props} />
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
    return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
    return (
        <ToastPrimitive.Viewport
            data-slot="toast-viewport"
            className={cn(
                "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
                className
            )}
            {...props}
        />
    )
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
    return (
        <ToastPrimitive.Root
            data-slot="toast"
            className={cn(
                "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-[22px] border border-white/[0.12] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1c1d28]/98 via-[#111218]/99 to-[#08090c] text-white shadow-[0_25px_70px_rgba(0,0,0,0.95)] outline-none select-none focus-visible:border-white/40 focus-visible:ring-[3px] focus-visible:ring-white/20 antialiased [text-rendering:geometricPrecision]",
                "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
                "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_400ms_cubic-bezier(0.16,1,0.3,1),opacity_300ms,height_150ms]",
                "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
                "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
                "data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]",
                "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
                "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
                "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
                "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
                "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
                "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
                "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
                "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
                "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
                className
            )}
            {...props}
        />
    )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
    return (
        <ToastPrimitive.Content
            data-slot="toast-content"
            className={cn(
                "flex h-full items-center gap-3 overflow-hidden px-4.5 py-3.5 transition-opacity duration-200 ease-out data-behind:opacity-0 data-expanded:opacity-100",
                className
            )}
            {...props}
        />
    )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
    return (
        <ToastPrimitive.Title
            data-slot="toast-title"
            className={cn("text-xs font-bold text-white tracking-tight leading-snug", className)}
            {...props}
        />
    )
}

function ToastDescription({
    className,
    ...props
}: ToastPrimitive.Description.Props) {
    return (
        <ToastPrimitive.Description
            data-slot="toast-description"
            className={cn("text-[13px] font-semibold text-white/90 leading-snug antialiased", className)}
            {...props}
        />
    )
}

function ToastAction({
    className,
    render = <Button variant="outline" size="sm" />,
    ...props
}: ToastPrimitive.Action.Props) {
    return (
        <ToastPrimitive.Action
            data-slot="toast-action"
            render={render}
            className={cn("shrink-0", className)}
            {...props}
        />
    )
}

function ToastClose({
    className,
    children,
    render = <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-white/40 hover:text-white hover:bg-white/10" />,
    ...props
}: ToastPrimitive.Close.Props) {
    return (
        <ToastPrimitive.Close
            data-slot="toast-close"
            aria-label="Close toast"
            render={render}
            className={cn(
                "relative shrink-0 text-white/45 after:absolute after:-inset-2 after:content-[''] hover:text-white cursor-pointer transition-colors",
                className
            )}
            {...props}
        >
            {children ?? <XIcon className="h-4 w-4" aria-hidden="true" />}
        </ToastPrimitive.Close>
    )
}

function ToastIcon({ type }: { type: string | undefined }) {
    let icon: React.ReactNode = null

    if (type === "success") {
        icon = <CircleCheckIcon className="h-4.5 w-4.5 text-emerald-400" aria-hidden="true" />
    }

    if (type === "info") {
        icon = <InfoIcon className="h-4.5 w-4.5 text-blue-400" aria-hidden="true" />
    }

    if (type === "warning") {
        icon = <TriangleAlertIcon className="h-4.5 w-4.5 text-amber-400" aria-hidden="true" />
    }

    if (type === "error") {
        icon = <OctagonXIcon className="h-4.5 w-4.5 text-rose-400" aria-hidden="true" />
    }

    if (type === "loading") {
        icon = <Loader2Icon className="h-4.5 w-4.5 animate-spin text-white/70" aria-hidden="true" />
    }

    if (!icon) {
        return null
    }

    return (
        <span
            data-slot="toast-icon"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.05] border border-white/10 shadow-sm"
        >
            {icon}
        </span>
    )
}

function ToastList() {
    const { toasts } = ToastPrimitive.useToastManager()

    return toasts.map((toastItem) => (
        <Toast key={toastItem.id} toast={toastItem}>
            <ToastContent>
                <ToastIcon type={toastItem.type} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {toastItem.title ? <ToastTitle /> : null}
                    <ToastDescription />
                </div>
                <ToastAction />
                <ToastClose />
            </ToastContent>
        </Toast>
    ))
}

function Toaster({
    children,
    toastManager = toast,
    ...props
}: ToastPrimitive.Provider.Props) {
    return (
        <ToastProvider toastManager={toastManager} {...props}>
            {children}
            <ToastPortal>
                <ToastViewport>
                    <ToastList />
                </ToastViewport>
            </ToastPortal>
        </ToastProvider>
    )
}

const createToastManager = ToastPrimitive.createToastManager
const useToastManager = ToastPrimitive.useToastManager

export {
    Toaster,
    Toast,
    ToastAction,
    ToastClose,
    ToastContent,
    ToastDescription,
    ToastPortal,
    ToastProvider,
    ToastTitle,
    ToastViewport,
    createToastManager,
    toast,
    useToastManager,
}
