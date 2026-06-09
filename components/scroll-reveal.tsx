'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  animation?: 'fade-up' | 'fade-left' | 'fade-right' | 'zoom-in' | 'slide-up'
  delay?: number
  stagger?: number // delay between staggered children (ms)
  threshold?: number
  once?: boolean
}

export function ScrollReveal({
  children,
  className = '',
  animation = 'fade-up',
  delay = 0,
  threshold = 0.15,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) observer.unobserve(el)
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, once])

  const animationStyles: Record<string, { from: string; to: string }> = {
    'fade-up': {
      from: 'opacity-0 translate-y-8',
      to: 'opacity-100 translate-y-0',
    },
    'fade-left': {
      from: 'opacity-0 translate-y-8',
      to: 'opacity-100 translate-y-0',
    },
    'fade-right': {
      from: 'opacity-0 translate-y-8',
      to: 'opacity-100 translate-y-0',
    },
    'zoom-in': {
      from: 'opacity-0 scale-95',
      to: 'opacity-100 scale-100',
    },
    'slide-up': {
      from: 'opacity-0 translate-y-12',
      to: 'opacity-100 translate-y-0',
    },
  }

  const style = animationStyles[animation]

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${isVisible ? style.to : style.from} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export function StaggerChildren({
  children,
  className = '',
  animation = 'fade-up',
  stagger = 100,
  threshold = 0.1,
}: {
  children: ReactNode
  className?: string
  animation?: 'fade-up' | 'fade-left' | 'fade-right' | 'zoom-in' | 'slide-up'
  stagger?: number
  threshold?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  const animationStyles: Record<string, { from: string; to: string }> = {
    'fade-up': {
      from: 'opacity-0 translate-y-8',
      to: 'opacity-100 translate-y-0',
    },
    'fade-left': {
      from: 'opacity-0 translate-y-8',
      to: 'opacity-100 translate-y-0',
    },
    'fade-right': {
      from: 'opacity-0 translate-y-8',
      to: 'opacity-100 translate-y-0',
    },
    'zoom-in': {
      from: 'opacity-0 scale-95',
      to: 'opacity-100 scale-100',
    },
    'slide-up': {
      from: 'opacity-0 translate-y-12',
      to: 'opacity-100 translate-y-0',
    },
  }

  const style = animationStyles[animation]

  return (
    <div ref={ref} className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div
              key={i}
              className={`transition-all duration-700 ease-out ${isVisible ? style.to : style.from}`}
              style={{ transitionDelay: isVisible ? `${i * stagger}ms` : '0ms' }}
            >
              {child}
            </div>
          ))
        : children}
    </div>
  )
}
