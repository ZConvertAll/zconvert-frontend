import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ZConvertAll = () => {
  const navigate = useNavigate();
  
  const converterTypes = [
    {
      emoji: '🖼',
      title: 'Images',
      type: 'images',
      description: 'Convert photos, graphics, and image formats'
    },
    {
      emoji: '🎬',
      title: 'Videos',
      type: 'videos', 
      description: 'Transform video files and formats'
    },
    {
      emoji: '🎵',
      title: 'Audios',
      type: 'audios',
      description: 'Convert audio files and sound formats'
    },
    {
      emoji: '📄',
      title: 'Documents',
      type: 'documents',
      description: 'Transform documents and text files'
    }
  ];

  const handleConverterClick = (type: string) => {
    navigate(`/converter?type=${type}`);
  };

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <header className="text-center py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 cursor-pointer hover:scale-105 transition-transform duration-300 bg-gradient-primary bg-clip-text text-transparent animate-fade-in">
            ZConvertAll
          </h1>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground animate-slide-up" style={{ animationDelay: '0.2s' }}>
            Convert Anything
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground animate-slide-up" style={{ animationDelay: '0.4s' }}>
            Simple, Fast & Flexible file converter
          </p>
        </div>
      </header>

      {/* Converter Types Grid */}
      <main className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {converterTypes.map((converter, index) => (
            <Card 
              key={converter.type}
              className="group cursor-pointer overflow-hidden border-2 hover:border-primary hover:shadow-glow transition-all duration-300 animate-bounce-in"
              style={{ animationDelay: `${0.6 + index * 0.1}s` }}
              onClick={() => handleConverterClick(converter.type)}
            >
              <div className="p-8 text-center">
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {converter.emoji}
                </div>
                <h3 className="text-2xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors duration-300">
                  {converter.title}
                </h3>
                <p className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                  {converter.description}
                </p>
                <Button 
                  className="mt-6 group-hover:scale-105 transition-transform duration-300 bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  Start Converting
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-muted-foreground space-y-3">
        <p className="text-sm">✨ Seamless conversions without requiring login or signup</p>
        <p className="text-xs">
          <a 
            href="https://ko-fi.com/zconvertall" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            ☕ Support us on Ko-Fi
          </a>
        </p>
      </footer>
    </div>
  );
};

export default ZConvertAll;