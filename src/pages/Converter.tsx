import React from 'react';
import { useSearchParams } from 'react-router-dom';
import FileConverter from '@/components/FileConverter';

const Converter = () => {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') as 'images' | 'videos' | 'audios' | 'documents';
  
  // Default to images if no valid type is provided
  const validTypes = ['images', 'videos', 'audios', 'documents'];
  const converterType = validTypes.includes(type) ? type : 'images';

  return <FileConverter type={converterType} />;
};

export default Converter;