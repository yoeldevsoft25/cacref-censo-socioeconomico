import { useEffect, useState, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { scaleSequential } from 'd3-scale';
import { interpolateReds } from 'd3-scale-chromatic';
import { Loader2, MapPin } from 'lucide-react';

// TopoJSON local: 25 entidades federales de Venezuela (23 estados + DC + Dependencias Federales)
const VENEZUELA_TOPOJSON = '/geo/venezuela-estados.json';

interface EstadoData {
  estado: string;
  topo_name: string;
  total: number;
  prioridad_alta: number;
  requiere_comite: number;
}

interface ApiResponse {
  estados: EstadoData[];
}

interface Props {
  /** Altura del mapa en px */
  height?: number;
  /** Centrar el mapa en coordenadas [lng, lat] */
  center?: [number, number];
  /** Zoom inicial */
  zoom?: number;
  /** Mostrar leyenda inferior */
  showLegend?: boolean;
}

/**
 * Mapa coroplético de Venezuela con la densidad de censos por estado.
 * - Color rojo intenso = más censos
 * - Gris claro = sin datos
 * - Tooltip con conteo y desglose (prioridad alta, comité)
 * - Responsive (se adapta al ancho del contenedor)
 */
export default function VenezuelaMap({ height = 420, center = [-66.5, 7.0], zoom = 2.6, showLegend = true }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredEstado, setHoveredEstado] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/transparencia/geo')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError('No se pudo cargar la data geografica.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  // Index de datos por nombre topográfico (lo que dice el TopoJSON)
  const dataByTopo = useMemo(() => {
    const m: Record<string, EstadoData> = {};
    (data?.estados || []).forEach((e) => { m[e.topo_name] = e; });
    return m;
  }, [data]);

  // Escala de color: rojo más intenso = más censos. Usamos d3 sequential para interpolar.
  const maxTotal = useMemo(() => {
    const totals = Object.values(dataByTopo).map((e: EstadoData) => e.total);
    return totals.length ? Math.max(...totals, 1) : 1;
  }, [dataByTopo]);

  const colorScale = useMemo(() => {
    return scaleSequential(interpolateReds).domain([0, Math.max(maxTotal, 5)]);
  }, [maxTotal]);

  const totalCensados = useMemo(
    () => Object.values(dataByTopo).reduce((acc: number, e: EstadoData) => acc + e.total, 0),
    [dataByTopo]
  );

  return (
    <div className="relative w-full">
      {/* Header con KPIs */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-800">
          <MapPin className="w-3.5 h-3.5" />
          <span className="font-bold">{totalCensados}</span>
          <span className="text-xs">censados geolocalizados</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700">
          <span className="text-xs">{Object.keys(dataByTopo).length} estados con data</span>
        </div>
      </div>

      <div className="relative rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white overflow-hidden" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm z-10">
            <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-600">
            {error}
          </div>
        )}

        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 900 }}
          width={800}
          height={height}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block' }}
          data-tip=""
        >
          <ZoomableGroup center={center} zoom={zoom} minZoom={zoom} maxZoom={8}>
            <Geographies geography={VENEZUELA_TOPOJSON}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const name: string = geo.properties.NAME_1;
                  const d = dataByTopo[name];
                  const total = d?.total || 0;
                  const fill = total === 0 ? '#e5e7eb' : colorScale(total);
                  const isHovered = hoveredEstado === name;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={(evt) => {
                        setHoveredEstado(name);
                        setTooltipPos({ x: evt.clientX, y: evt.clientY });
                      }}
                      onMouseMove={(evt) => setTooltipPos({ x: evt.clientX, y: evt.clientY })}
                      onMouseLeave={() => setHoveredEstado(null)}
                      style={{
                        default: {
                          fill,
                          stroke: '#ffffff',
                          strokeWidth: 0.6,
                          outline: 'none',
                          transition: 'fill 200ms ease',
                          cursor: 'pointer',
                        },
                        hover: {
                          fill: total === 0 ? '#d1d5db' : colorScale(total),
                          stroke: '#dc2626',
                          strokeWidth: 1.5,
                          outline: 'none',
                          filter: 'brightness(1.08)',
                        },
                        pressed: {
                          fill: colorScale(total),
                          stroke: '#dc2626',
                          strokeWidth: 1.5,
                          outline: 'none',
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip flotante */}
        {hoveredEstado && (() => {
          const d = dataByTopo[hoveredEstado];
          const total = d?.total || 0;
          return (
            <div
              className="fixed z-50 pointer-events-none bg-slate-900/95 text-white rounded-lg shadow-2xl px-3 py-2 text-xs"
              style={{ left: tooltipPos.x + 12, top: tooltipPos.y + 12, maxWidth: 220 }}
            >
              <p className="font-bold text-sm mb-1">{hoveredEstado}</p>
              {total > 0 ? (
                <>
                  <p className="text-red-300 font-semibold">{total} censo{total !== 1 ? 's' : ''}</p>
                  {d!.prioridad_alta > 0 && (
                    <p className="text-amber-300">· {d!.prioridad_alta} prioridad alta</p>
                  )}
                  {d!.requiere_comite > 0 && (
                    <p className="text-blue-300">· {d!.requiere_comite} en comité</p>
                  )}
                </>
              ) : (
                <p className="text-slate-400">Sin censos registrados</p>
              )}
            </div>
          );
        })()}
      </div>

      {/* Leyenda de color */}
      {showLegend && (
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
          <span className="font-semibold">Densidad:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-slate-200" />
            <span>0</span>
          </div>
          <div className="h-3 w-32 rounded" style={{ background: 'linear-gradient(to right, #fee5d9, #fcae91, #fb6a4a, #cb181d)' }} />
          <span>{maxTotal}+</span>
        </div>
      )}
    </div>
  );
}
