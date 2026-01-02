'use client';

import { PieChart, Building2, MapPin, Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@skillancer/ui/card';
import { Progress } from '@skillancer/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui/tabs';

interface WorkforceCompositionWidgetProps {
  data?: {
    byDepartment: Array<{
      name: string;
      count: number;
      percentage: number;
      color: string;
    }>;
    byLocation: Array<{
      name: string;
      count: number;
      percentage: number;
    }>;
    byLevel: Array<{
      name: string;
      count: number;
      percentage: number;
    }>;
    totalEmployees: number;
  };
  isLoading?: boolean;
}

const departmentColors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-yellow-500',
  'bg-red-500',
];

export function WorkforceCompositionWidget({ data, isLoading }: WorkforceCompositionWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Workforce Composition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-muted h-8 rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Workforce Composition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center">
            No workforce data available. Connect your HRIS to see composition breakdown.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Workforce Composition
          <span className="text-muted-foreground ml-auto text-sm font-normal">
            {data.totalEmployees} employees
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="department" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="department" className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Department
            </TabsTrigger>
            <TabsTrigger value="location" className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              Location
            </TabsTrigger>
            <TabsTrigger value="level" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Level
            </TabsTrigger>
          </TabsList>

          <TabsContent value="department" className="space-y-4">
            {/* Horizontal stacked bar */}
            <div className="flex h-8 overflow-hidden rounded-lg">
              {data.byDepartment.map((dept, i) => (
                <div
                  key={dept.name}
                  className={`${departmentColors[i % departmentColors.length]} transition-all hover:opacity-80`}
                  style={{ width: `${dept.percentage}%` }}
                  title={`${dept.name}: ${dept.count} (${dept.percentage}%)`}
                />
              ))}
            </div>

            {/* Legend/Details */}
            <div className="grid grid-cols-2 gap-3">
              {data.byDepartment.map((dept, i) => (
                <div key={dept.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 rounded-full ${departmentColors[i % departmentColors.length]}`}
                    />
                    <span className="text-sm">{dept.name}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {dept.count} ({dept.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="location" className="space-y-3">
            {data.byLocation.map((loc) => (
              <div key={loc.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {loc.name}
                  </span>
                  <span className="font-medium">
                    {loc.count} ({loc.percentage}%)
                  </span>
                </div>
                <Progress value={loc.percentage} className="h-2" />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="level" className="space-y-3">
            {data.byLevel.map((level) => (
              <div key={level.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{level.name}</span>
                  <span className="font-medium">
                    {level.count} ({level.percentage}%)
                  </span>
                </div>
                <Progress value={level.percentage} className="h-2" />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
