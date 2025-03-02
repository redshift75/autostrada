import { useEffect, useRef, useState } from 'react';
import type { TopLevelSpec } from 'vega-lite';

interface VegaChartProps {
  spec: TopLevelSpec;
  className?: string;
  onSignalClick?: (name: string, value: any) => void;
}

/**
 * A reusable component for rendering Vega-Lite visualizations
 */
export default function VegaChart({ spec, className, onSignalClick }: VegaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !spec) {
      console.log('VegaChart: Missing container or spec', { hasContainer: !!containerRef.current, hasSpec: !!spec });
      return;
    }

    console.log('VegaChart: Rendering chart with spec type:', typeof spec);
    console.log('VegaChart: Spec description:', (spec as any).description);

    // Clear any previous errors
    setError(null);

    // Dynamically import vega-embed to avoid SSR issues
    import('vega-embed').then(({ default: vegaEmbed }) => {
      console.log('vega-embed loaded successfully');
      
      try {
        // Ensure we're working with a proper Vega-Lite specification
        if (typeof spec === 'string') {
          try {
            // Try to parse it as JSON
            const parsedSpec = JSON.parse(spec);
            renderChart(parsedSpec, vegaEmbed);
          } catch (error) {
            console.error('Failed to parse string spec:', error);
            setError('Failed to parse chart specification');
            return;
          }
        } else {
          // Continue with the object spec
          renderChart(spec, vegaEmbed);
        }
      } catch (error) {
        console.error('Error in VegaChart component:', error);
        setError('Error initializing chart');
      }
    }).catch(error => {
      console.error('Failed to load vega-embed:', error);
      setError('Failed to load visualization library');
    });

    function renderChart(chartSpec: any, vegaEmbed: any) {
      try {
        // Check if the spec has required Vega-Lite properties
        const specAny = chartSpec as any;
        if (!specAny.mark && !specAny.layer && !specAny.facet && !specAny.hconcat && 
            !specAny.vconcat && !specAny.concat && !specAny.repeat) {
          console.error('Invalid Vega-Lite specification: Missing required properties', chartSpec);
          setError('Invalid chart specification');
          return;
        }

        // Create a deep copy of the spec to avoid modifying the original
        const specCopy = JSON.parse(JSON.stringify(chartSpec));

        // Create a modified spec with responsive width
        const responsiveSpec = {
          ...specCopy,
          width: "container", // Make width responsive to container
          height: 400, // Set a fixed height
          autosize: {
            type: "fit",
            contains: "padding",
            resize: true
          }
        };

        // Add signals for histogram selection if it's a histogram
        const isHistogram = specAny.description?.includes('Distribution');
        
        if (isHistogram) {
          // For Vega-Lite, we need to use a different approach for signals
          // We'll use selection instead of signals directly
          const histogramSpec = {
            ...responsiveSpec,
            selection: {
              barSelection: {
                type: "single",
                encodings: ["x"],
                on: "click",
                clear: "dblclick",
                resolve: "global"
              }
            }
          };

          // Safely handle the mark property
          if (typeof histogramSpec.mark === 'string') {
            // If mark is a string (e.g., 'bar'), convert it to an object
            histogramSpec.mark = {
              type: histogramSpec.mark,
              cursor: 'pointer'
            };
          } else if (typeof histogramSpec.mark === 'object') {
            // If mark is already an object, just add the cursor property
            histogramSpec.mark = {
              ...histogramSpec.mark,
              cursor: 'pointer'
            };
          } else {
            // If mark is undefined or something else, set a default
            histogramSpec.mark = {
              type: 'bar',
              cursor: 'pointer'
            };
          }

          vegaEmbed(containerRef.current!, histogramSpec as any, {
            actions: { export: true, source: false, compiled: false, editor: false },
            renderer: 'svg',
            mode: 'vega-lite'
          }).then((result: any) => {
            viewRef.current = result.view;
            
            // Add signal listener for histogram bar clicks
            if (onSignalClick) {
              result.view.addEventListener('click', (event: any, item: any) => {
                if (item && item.datum) {
                  onSignalClick('barClick', item.datum);
                }
              });
            }
          }).catch((error: Error) => {
            console.error('Error rendering Vega chart:', error);
            console.error('Problematic spec:', JSON.stringify(histogramSpec));
            setError('Error rendering chart');
          });
        } else {
          vegaEmbed(containerRef.current!, responsiveSpec as any, {
            actions: { export: true, source: false, compiled: false, editor: false },
            renderer: 'svg',
            mode: 'vega-lite'
          }).then((result: any) => {
            viewRef.current = result.view;
          }).catch((error: Error) => {
            console.error('Error rendering Vega chart:', error);
            console.error('Problematic spec:', JSON.stringify(responsiveSpec));
            setError('Error rendering chart');
          });
        }
      } catch (error) {
        console.error('Error in renderChart function:', error);
        setError('Error preparing chart');
      }
    }

    // Cleanup function
    return () => {
      if (viewRef.current) {
        viewRef.current.finalize();
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [spec, onSignalClick]);

  return (
    <div className="relative">
      <div ref={containerRef} className={className} style={{ minHeight: "400px" }} />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80">
          <div className="text-red-600 dark:text-red-400 text-center p-4">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
} 