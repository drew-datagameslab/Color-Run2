import { useEffect, useRef } from 'react';
// @ts-ignore
import { mount } from './bundle.js';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const unmount = mount(containerRef.current);
      return () => {
        unmount?.();
      };
    }
  }, []);

  return <div ref={containerRef} className="w-full h-full min-h-screen" />;
}

