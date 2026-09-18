"use client";

import { gelatoCountriesByGroup } from "@/lib/gelato-countries";
import { Label } from "@/components/ui/label";

export function CountrySelect({
  value,
  onChange,
  id = "country",
  label = "Country",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={className || "space-y-1.5"}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {gelatoCountriesByGroup().map((group) => (
          <optgroup key={group.group} label={group.group}>
            {group.countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
