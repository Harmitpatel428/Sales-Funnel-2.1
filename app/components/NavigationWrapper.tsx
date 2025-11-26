'use client';

import { useNavigation } from '../context/NavigationContext';
import Navigation from './Navigation';

export default function NavigationWrapper() {
  const { onExportClick } = useNavigation();
  
  return (
    <Navigation 
      onExportClick={onExportClick}
    />
  );
}
