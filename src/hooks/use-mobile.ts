import { useEffect, useState } from 'react';

const MOBILE_UA_REGEX = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return MOBILE_UA_REGEX.test(navigator.userAgent) || window.innerWidth < 768;
};

const useMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(isMobileDevice());
    check();

    const mq = window.matchMedia('(max-width: 767px)');
    mq.addEventListener('change', check);
    return () => mq.removeEventListener('change', check);
  }, []);

  return isMobile;
};

export default useMobile;
