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
        const isPriceHistogram = specAny.description?.includes('Price Distribution');
        const isMileageHistogram = specAny.description?.includes('Mileage Distribution');
        
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
            actions: false, // Disable all actions including export dropdown
            renderer: 'svg',
            mode: 'vega-lite'
          }).then((result: any) => {
            viewRef.current = result.view;
            
            // Add signal listener for histogram bar clicks
            if (onSignalClick) {
              result.view.addEventListener('click', (event: any, item: any) => {
                if (item && item.datum) {
                  console.log('Chart click event:', item.datum);
                  
                  // Normalize the data format for consistent handling in parent components
                  let normalizedData = item.datum;
                  
                  // For price histogram
                  if (isPriceHistogram) {
                    // Check if we have bin_maxbins_20_price format (actual format from Vega-Lite)
                    if (normalizedData.bin_maxbins_20_price !== undefined && normalizedData.bin_maxbins_20_price_end !== undefined) {
                      normalizedData = {
                        price_bin0: normalizedData.bin_maxbins_20_price,
                        price_bin1: normalizedData.bin_maxbins_20_price_end
                      };
                    }
                    // Check if we have bin_start and bin_end properties
                    else if (normalizedData.bin_start !== undefined && normalizedData.bin_end !== undefined) {
                      normalizedData = {
                        price_bin0: normalizedData.bin_start,
                        price_bin1: normalizedData.bin_end
                      };
                    } 
                    // Check if we have price bin properties
                    else if (normalizedData.price !== undefined && normalizedData.price_end !== undefined) {
                      normalizedData = {
                        price_bin0: normalizedData.price,
                        price_bin1: normalizedData.price_end
                      };
                    }
                    // Check for bin0 and bin1 format
                    else if (normalizedData.bin0 !== undefined && normalizedData.bin1 !== undefined) {
                      normalizedData = {
                        price_bin0: normalizedData.bin0,
                        price_bin1: normalizedData.bin1
                      };
                    }
                  } 
                  // For mileage histogram
                  else if (isMileageHistogram) {
                    // Check if we have bin_maxbins_20_mileage format (actual format from Vega-Lite)
                    if (normalizedData.bin_maxbins_20_mileage !== undefined && normalizedData.bin_maxbins_20_mileage_end !== undefined) {
                      normalizedData = {
                        mileage_bin0: normalizedData.bin_maxbins_20_mileage,
                        mileage_bin1: normalizedData.bin_maxbins_20_mileage_end
                      };
                    }
                    // Check if we have bin_start and bin_end properties
                    else if (normalizedData.bin_start !== undefined && normalizedData.bin_end !== undefined) {
                      normalizedData = {
                        mileage_bin0: normalizedData.bin_start,
                        mileage_bin1: normalizedData.bin_end
                      };
                    } 
                    // Check if we have mileage bin properties
                    else if (normalizedData.mileage !== undefined && normalizedData.mileage_end !== undefined) {
                      normalizedData = {
                        mileage_bin0: normalizedData.mileage,
                        mileage_bin1: normalizedData.mileage_end
                      };
                    }
                    // Check for bin0 and bin1 format
                    else if (normalizedData.bin0 !== undefined && normalizedData.bin1 !== undefined) {
                      normalizedData = {
                        mileage_bin0: normalizedData.bin0,
                        mileage_bin1: normalizedData.bin1
                      };
                    }
                  }
                  
                  console.log('Normalized click data:', normalizedData);
                  onSignalClick('barClick', normalizedData);
                }
              });
              
              // Add double-click event listener to clear filters
              result.view.addEventListener('dblclick', () => {
                console.log('Chart double-click event detected');
                onSignalClick('clearFilters', null);
              });
            }
          }).catch((error: Error) => {
            console.error('Error rendering Vega chart:', error);
            console.error('Problematic spec:', JSON.stringify(histogramSpec));
            setError('Error rendering chart');
          });
        } else {
          // Check if this is a time series chart
          const isTimeSeries = specAny.description?.includes('Price Trends') || 
                             specAny.description?.includes('Historical Price');
          
          // Add cursor pointer to points for time series charts
          if (isTimeSeries) {
            if (typeof responsiveSpec.mark === 'string' && responsiveSpec.mark === 'point') {
              responsiveSpec.mark = {
                type: 'point',
                cursor: 'pointer'
              };
            } else if (typeof responsiveSpec.mark === 'object') {
              responsiveSpec.mark = {
                ...responsiveSpec.mark,
                cursor: 'pointer'
              };
            }
          }
          
          vegaEmbed(containerRef.current!, responsiveSpec as any, {
            actions: false, // Disable all actions including export dropdown
            renderer: 'svg',
            mode: 'vega-lite'
          }).then((result: any) => {
            viewRef.current = result.view;
            
            // Add click event listener for time series chart points
            if (onSignalClick) {
              // Check if this is a time series chart or scatter plot
              const isTimeSeries = specAny.description?.includes('Price Trends') || 
                                 specAny.description?.includes('Historical Price');
              const isScatterPlot = specAny.description?.includes('Price vs. Mileage');

              if (isTimeSeries || isScatterPlot) {
                result.view.addEventListener('click', (event: any, item: any) => {
                  if (item && item.datum) {
                    onSignalClick('pointClick', item.datum);
                  }
                });
              }
            }
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