import { useMemo, useState } from 'react';
import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json';
import type { BreakdownItem } from '@leo/shared';
import { countryFlag, countryName, formatCompact } from '../lib/format';

// ISO 3166-1 numeric -> alpha-2 for the most common countries in world-atlas
const NUM_TO_ALPHA2: Record<string, string> = {
  '004': 'AF', '008': 'AL', '012': 'DZ', '024': 'AO', '032': 'AR', '036': 'AU',
  '040': 'AT', '050': 'BD', '056': 'BE', '068': 'BO', '076': 'BR', '100': 'BG',
  '124': 'CA', '152': 'CL', '156': 'CN', '170': 'CO', '188': 'CR', '191': 'HR',
  '192': 'CU', '203': 'CZ', '208': 'DK', '214': 'DO', '218': 'EC', '818': 'EG',
  '233': 'EE', '246': 'FI', '250': 'FR', '276': 'DE', '288': 'GH', '300': 'GR',
  '320': 'GT', '340': 'HN', '344': 'HK', '348': 'HU', '352': 'IS', '356': 'IN',
  '360': 'ID', '364': 'IR', '368': 'IQ', '372': 'IE', '376': 'IL', '380': 'IT',
  '392': 'JP', '400': 'JO', '398': 'KZ', '404': 'KE', '410': 'KR', '428': 'LV',
  '440': 'LT', '442': 'LU', '458': 'MY', '484': 'MX', '504': 'MA', '528': 'NL',
  '554': 'NZ', '566': 'NG', '578': 'NO', '586': 'PK', '591': 'PA', '600': 'PY',
  '604': 'PE', '608': 'PH', '616': 'PL', '620': 'PT', '634': 'QA', '642': 'RO',
  '643': 'RU', '682': 'SA', '688': 'RS', '702': 'SG', '703': 'SK', '705': 'SI',
  '710': 'ZA', '724': 'ES', '752': 'SE', '756': 'CH', '158': 'TW', '764': 'TH',
  '792': 'TR', '804': 'UA', '784': 'AE', '826': 'GB', '840': 'US', '858': 'UY',
  '862': 'VE', '704': 'VN',
};

interface Props {
  countries: BreakdownItem[];
  onSelectCountry: (code: string) => void;
}

export function WorldMap({ countries, onSelectCountry }: Props) {
  const [hovered, setHovered] = useState<{ code: string; visitors: number } | null>(null);

  const countMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of countries) {
      m.set(c.key.toUpperCase(), c.visitors);
    }
    return m;
  }, [countries]);

  const maxVisitors = useMemo(
    () => Math.max(1, ...countries.map((c) => c.visitors)),
    [countries]
  );

  const paths = useMemo(() => {
    const topo = worldAtlas as unknown as Parameters<typeof feature>[0] & {
      objects: { countries: Parameters<typeof feature>[1] };
    };
    const geo = feature(topo, topo.objects.countries) as unknown as {
      type: 'FeatureCollection';
      features: Array<{ id?: string | number } & GeoPermissibleObjects>;
    };
    const projection = geoNaturalEarth1().fitSize([560, 290], geo as unknown as GeoPermissibleObjects);
    const pathGen = geoPath(projection);

    return geo.features
      .filter((f) => String(f.id) !== '010') // Hide Antarctica for cleaner proportions
      .map((f) => {
        const idStr = String(f.id ?? '').padStart(3, '0');
        const code = NUM_TO_ALPHA2[idStr] || '';
        return {
          id: idStr,
          code,
          d: pathGen(f) || '',
        };
      });
  }, []);

  function fillFor(code: string): string {
    const v = code ? countMap.get(code) || 0 : 0;
    if (v === 0) return '#eef0f6';
    const ratio = v / maxVisitors;
    if (ratio > 0.7) return '#4f46e5';
    if (ratio > 0.4) return '#6366f1';
    if (ratio > 0.18) return '#818cf8';
    if (ratio > 0.06) return '#a5b4fc';
    return '#c7d2fe';
  }

  return (
    <div className="relative flex h-full min-h-[290px] flex-col items-center justify-center">
      <svg viewBox="0 0 560 290" className="w-full h-auto max-h-[300px]">
        <g>
          {paths.map((p) => {
            const visitors = p.code ? countMap.get(p.code) || 0 : 0;
            return (
              <path
                key={p.id}
                d={p.d}
                fill={fillFor(p.code)}
                stroke="#ffffff"
                strokeWidth={0.6}
                className={`transition-colors ${
                  visitors > 0 ? 'cursor-pointer hover:opacity-85' : ''
                }`}
                onMouseEnter={() => {
                  if (p.code) setHovered({ code: p.code, visitors });
                }}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (p.code && visitors > 0) onSelectCountry(p.code);
                }}
              />
            );
          })}
        </g>
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-zinc-200 bg-zinc-950 px-3 py-1.5 text-xs text-white shadow-lg">
          <span className="mr-1.5">{countryFlag(hovered.code)}</span>
          <span className="font-medium">{countryName(hovered.code)}</span>
          <span className="ml-2 text-zinc-400 tabular-nums">
            {formatCompact(hovered.visitors)} visitors
          </span>
        </div>
      )}
    </div>
  );
}
