import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { TargetAudience, AUDIENCE_LABELS, MANAGEMENT_POSITION_LABELS, ManagementPosition, COMMON_SUBJECTS } from '@/types';
import { metadataApi } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface AudienceSelectorProps {
  audience: TargetAudience;
  onAudienceChange: (audience: TargetAudience) => void;
  selectedPersonIds: string[];
  onSelectedPersonIdsChange: (ids: string[]) => void;
  selectedClass: string;
  onSelectedClassChange: (cls: string) => void;
  selectedSubject: string;
  onSelectedSubjectChange: (subj: string) => void;
}

const AudienceSelector: React.FC<AudienceSelectorProps> = ({
  audience,
  onAudienceChange,
  selectedPersonIds,
  onSelectedPersonIdsChange,
  selectedClass,
  onSelectedClassChange,
  selectedSubject,
  onSelectedSubjectChange,
}) => {
  const { user, allUsers } = useAuth();
  const { data: classOptions = [] } = useQuery({
    queryKey: ['schoolClasses', user?.school],
    queryFn: () => metadataApi.getClasses(user?.school),
    enabled: !!user,
  });

  // Management staff (role=director with managementPosition)
  const managementStaff = useMemo(
    () => allUsers.filter(u => u.role === 'director' && u.managementPosition),
    [allUsers]
  );

  // All unique classes from students
  const allClasses = useMemo(() => {
    const classes = new Set<string>(classOptions.map(option => option.name));
    allUsers.forEach(u => {
      if (u.role === 'student' && u.class) {
        classes.add(u.class);
      }
    });

    const parseClass = (c: string) => {
      const match = c.match(/^(\d+)(.*)$/);
      if (!match) return { num: 0, suffix: c };
      return { num: parseInt(match[1], 10), suffix: match[2] };
    };

    return Array.from(classes).sort((a, b) => {
      const classA = parseClass(a);
      const classB = parseClass(b);
      if (classA.num !== classB.num) return classB.num - classA.num;
      return classA.suffix.localeCompare(classB.suffix, 'bg');
    });
  }, [allUsers, classOptions]);

  // Students filtered by selected class and sorted by number
  const filteredStudents = useMemo(
    () => selectedClass
      ? allUsers
          .filter(u => u.role === 'student' && u.class === selectedClass)
          .sort((a, b) => (a.classNumber || 0) - (b.classNumber || 0))
      : [],
    [allUsers, selectedClass]
  );

  // Teachers filtered by subject (handles multi-subject strings)
  const filteredTeachers = useMemo(
    () => selectedSubject && selectedSubject !== 'all_subjects'
      ? allUsers.filter(u => u.role === 'teacher' && u.subject?.split(', ')?.includes(selectedSubject))
      : [],
    [allUsers, selectedSubject]
  );

  const handleAudienceChange = (v: string) => {
    onAudienceChange(v as TargetAudience);
    onSelectedPersonIdsChange([]);
    onSelectedClassChange('');
    onSelectedSubjectChange('');
  };

  const handleClassChange = (cls: string) => {
    onSelectedClassChange(cls);
    onSelectedPersonIdsChange([]);
  };

  const handleSubjectChange = (subj: string) => {
    onSelectedSubjectChange(subj);
    onSelectedPersonIdsChange([]);
  };

  const togglePerson = (id: string, allValue: string) => {
    if (id === allValue) {
      onSelectedPersonIdsChange([]);
      return;
    }
    
    const newIds = selectedPersonIds.includes(id)
      ? selectedPersonIds.filter(i => i !== id)
      : [...selectedPersonIds, id];
    
    onSelectedPersonIdsChange(newIds);
  };

  const getTeacherLabel = (u: any) => {
    let label = `${u.firstName} ${u.lastName}`;
    if (u.teacherType === 'class') {
      label += ` (Класен – ${u.class})`;
    } else {
      label += ' (Редовен)';
    }
    return label;
  };

  const renderMultiSelect = (users: any[], allValue: string, allLabel: string, getLabel: (u: any) => string) => {
    const isAllSelected = selectedPersonIds.length === 0;

    return (
      <div className="space-y-3">
        <Label className="font-bold text-sm mb-1.5 block">Изберете получатели</Label>
        <div className="border border-primary/10 rounded-2xl p-4 bg-secondary/5">
          <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-primary/5">
            <Checkbox 
              id={allValue} 
              checked={isAllSelected}
              onCheckedChange={() => onSelectedPersonIdsChange([])}
              className="rounded-md"
            />
            <label htmlFor={allValue} className="text-sm font-black cursor-pointer uppercase tracking-wider">{allLabel}</label>
          </div>
          <ScrollArea className="h-48 pr-4">
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="flex items-center space-x-3 group">
                  <Checkbox 
                    id={u.id} 
                    checked={selectedPersonIds.includes(u.id)}
                    onCheckedChange={() => togglePerson(u.id, allValue)}
                    className="rounded-md"
                  />
                  <label 
                    htmlFor={u.id} 
                    className="text-sm font-bold cursor-pointer transition-colors group-hover:text-primary"
                  >
                    {getLabel(u)}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        {selectedPersonIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[10px] font-black uppercase text-muted-foreground w-full mb-1">Избрани ({selectedPersonIds.length}):</span>
            {selectedPersonIds.map(id => {
              const u = allUsers.find(user => user.id === id);
              if (!u) return null;
              return (
                <Badge key={id} variant="secondary" className="rounded-full pl-2 pr-1 py-0.5 gap-1 font-bold border-primary/10">
                  {u.firstName} {u.lastName}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    onClick={() => togglePerson(id, allValue)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="font-bold text-sm mb-1.5 block">Целева аудитория</Label>
        <Select value={audience} onValueChange={handleAudienceChange}>
          <SelectTrigger className="rounded-2xl h-11 border-primary/20"><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-2xl border-primary/10">
            {(Object.entries(AUDIENCE_LABELS) as [string, string][])
              .filter(([k]) => k !== 'admin' || user?.role === 'director')
              .map(([k, v]) => (
                <SelectItem key={k} value={k} className="font-bold">{v}</SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Director sub-selector */}
      {audience === 'director' && renderMultiSelect(
        managementStaff,
        'all_management',
        'Всички директори',
        (u) => `${u.firstName} ${u.lastName} – ${MANAGEMENT_POSITION_LABELS[u.managementPosition!]}`
      )}

      {/* Students sub-selectors */}
      {audience === 'students' && (
        <>
          <div>
            <Label className="font-bold text-sm mb-1.5 block">Изберете клас</Label>
            <Select value={selectedClass} onValueChange={handleClassChange}>
              <SelectTrigger className="rounded-2xl h-11 border-primary/20"><SelectValue placeholder="Изберете клас..." /></SelectTrigger>
              <SelectContent className="rounded-2xl border-primary/10">
                <SelectItem value="all_classes" className="font-bold">Всички класове</SelectItem>
                {allClasses.map(cls => (
                  <SelectItem key={cls} value={cls} className="font-bold">{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedClass && selectedClass !== 'all_classes' && renderMultiSelect(
            filteredStudents,
            'all_in_class',
            `Всички от ${selectedClass}`,
            (u) => `${u.classNumber ? `#${u.classNumber} ` : ''}${u.firstName} ${u.lastName}${!user?.school ? ` (${u.school})` : ''}`
          )}
        </>
      )}

      {/* Teachers sub-selectors */}
      {audience === 'teachers' && (
        <>
          <div>
            <Label className="font-bold text-sm mb-1.5 block">Изберете предмет</Label>
            <Select value={selectedSubject} onValueChange={handleSubjectChange}>
              <SelectTrigger className="rounded-2xl h-11 border-primary/20"><SelectValue placeholder="Изберете предмет..." /></SelectTrigger>
              <SelectContent className="rounded-2xl border-primary/10">
                <SelectItem value="all_subjects" className="font-bold">Всички предмети</SelectItem>
                {COMMON_SUBJECTS.map(subj => (
                  <SelectItem key={subj} value={subj} className="font-bold">{subj}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedSubject && selectedSubject !== 'all_subjects' && renderMultiSelect(
            filteredTeachers,
            'all_in_subject',
            `Всички по ${selectedSubject}`,
            (u) => getTeacherLabel(u)
          )}
        </>
      )}
    </div>
  );
};

export default AudienceSelector;
