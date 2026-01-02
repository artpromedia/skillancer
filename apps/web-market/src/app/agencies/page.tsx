import { Badge, Card, CardContent, Button } from '@skillancer/ui';
import { Users, Star, MapPin, CheckCircle2 } from 'lucide-react';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hire an Agency - Skillancer',
  description: 'Partner with verified agencies for larger projects requiring full teams.',
};

const agencies = [
  {
    id: '1',
    name: 'PixelCraft Studios',
    specialty: 'UI/UX & Branding',
    location: 'San Francisco',
    rating: 4.9,
    projects: 156,
    teamSize: '15-25',
    verified: true,
  },
  {
    id: '2',
    name: 'CodeForge Labs',
    specialty: 'Full-Stack Development',
    location: 'London',
    rating: 4.8,
    projects: 203,
    teamSize: '25-50',
    verified: true,
  },
  {
    id: '3',
    name: 'GrowthHackers Inc',
    specialty: 'Digital Marketing',
    location: 'New York',
    rating: 4.9,
    projects: 312,
    teamSize: '10-20',
    verified: true,
  },
  {
    id: '4',
    name: 'MobileFirst Agency',
    specialty: 'Mobile Development',
    location: 'Berlin',
    rating: 4.7,
    projects: 98,
    teamSize: '10-15',
    verified: true,
  },
];

export default function AgenciesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 border-blue-500/30 bg-blue-500/10 text-blue-300">
            <Users className="mr-1 h-3 w-3" />
            Agency Partners
          </Badge>
          <h1 className="mb-4 text-4xl font-bold">Hire an Agency</h1>
          <p className="mx-auto max-w-2xl text-slate-400">
            Partner with verified agencies for larger projects requiring dedicated teams.
          </p>
        </div>
      </section>
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {agencies.map((a) => (
            <Card key={a.id} className="transition-all hover:shadow-lg">
              <CardContent className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">{a.name}</h3>
                      {a.verified && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                    </div>
                    <p className="text-slate-600">{a.specialty}</p>
                  </div>
                  <Badge variant="secondary">{a.teamSize} people</Badge>
                </div>
                <div className="mb-4 flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {a.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {a.rating}
                  </span>
                  <span>{a.projects} projects</span>
                </div>
                <Button className="w-full bg-emerald-500 text-white hover:bg-emerald-600">
                  View Agency Profile
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
