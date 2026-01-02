import { Badge, Card, CardContent, Button } from '@skillancer/ui';
import { Headphones, Play, Clock, Users, ExternalLink } from 'lucide-react';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Podcast - Skillancer',
  description: 'The Skillancer Podcast: Stories, tips, and insights from top freelancers.',
};

const episodes = [
  {
    id: 1,
    title: 'From $0 to $100K: A Freelance Journey',
    guest: 'Sarah Chen',
    duration: '45 min',
    plays: '12.5K',
  },
  {
    id: 2,
    title: 'Mastering Client Communication',
    guest: 'Marcus Johnson',
    duration: '38 min',
    plays: '9.8K',
  },
  {
    id: 3,
    title: 'Building a Personal Brand Online',
    guest: 'Lisa Park',
    duration: '52 min',
    plays: '15.2K',
  },
  {
    id: 4,
    title: 'Pricing Strategies That Work',
    guest: 'David Miller',
    duration: '41 min',
    plays: '11.3K',
  },
  {
    id: 5,
    title: 'Work-Life Balance as a Freelancer',
    guest: 'Emma Wilson',
    duration: '35 min',
    plays: '8.7K',
  },
  {
    id: 6,
    title: 'Scaling Your Freelance Business',
    guest: 'Alex Thompson',
    duration: '48 min',
    plays: '14.1K',
  },
];

const platforms = [
  { name: 'Spotify', color: 'bg-green-500' },
  { name: 'Apple Podcasts', color: 'bg-purple-500' },
  { name: 'Google Podcasts', color: 'bg-blue-500' },
  { name: 'YouTube', color: 'bg-red-500' },
];

export default function PodcastPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-r from-slate-900 to-slate-800 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 border-purple-500/30 bg-purple-500/10 text-purple-300">
            <Headphones className="mr-1 h-3 w-3" />
            Podcast
          </Badge>
          <h1 className="mb-4 text-4xl font-bold">The Skillancer Podcast</h1>
          <p className="mx-auto max-w-2xl text-slate-400">
            Weekly episodes featuring stories, tips, and insights from successful freelancers around
            the world.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {platforms.map((p) => (
              <Button
                key={p.name}
                className="border-white/20 text-white hover:bg-white/10"
                variant="outline"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {p.name}
              </Button>
            ))}
          </div>
        </div>
      </section>
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest Episodes</h2>
          <Badge variant="secondary">
            <Users className="mr-1 h-3 w-3" />
            50K+ listeners
          </Badge>
        </div>
        <div className="space-y-4">
          {episodes.map((e) => (
            <Card key={e.id} className="transition-all hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <button className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600">
                  <Play className="h-6 w-6" />
                </button>
                <div className="flex-1">
                  <h3 className="font-semibold">{e.title}</h3>
                  <p className="text-sm text-slate-500">with {e.guest}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {e.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <Headphones className="h-4 w-4" />
                    {e.plays}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button variant="outline">Load More Episodes</Button>
        </div>
      </div>
    </div>
  );
}
