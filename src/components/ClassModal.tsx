import React, { useState, useEffect } from 'react';
import type { ClassItem, ClassType, DayOfWeek } from '../types/timetable';
import { DAYS_LIST } from '../data/timetable';

import { XIcon, AlertCircleIcon } from './Icons';
import { timeToMinutes } from '../utils/timeUtils';

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (classData: Omit<ClassItem, 'id'> | ClassItem) => void;
  initialData?: ClassItem | null;
  defaultDay?: DayOfWeek;
}

export const ClassModal: React.FC<ClassModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultDay = 'Monday',
}) => {
  const isEditing = !!initialData;

  const [subject, setSubject] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [teacher, setTeacher] = useState('');
  const [room, setRoom] = useState('');
  const [day, setDay] = useState<DayOfWeek>(defaultDay);
  const [startTime, setStartTime] = useState('08:50');
  const [endTime, setEndTime] = useState('09:40');
  const [batch, setBatch] = useState('');
  const [type, setType] = useState<ClassType>('lecture');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setSubject(initialData.subject);
      setCourseCode(initialData.courseCode);
      setTeacher(initialData.teacher);
      setRoom(initialData.room);
      setDay(initialData.day);
      setStartTime(initialData.startTime);
      setEndTime(initialData.endTime);
      setBatch(initialData.batch || '');
      setType(initialData.type);
    } else {
      setSubject('');
      setCourseCode('');
      setTeacher('');
      setRoom('');
      setDay(defaultDay);
      setStartTime('08:50');
      setEndTime('09:40');
      setBatch('');
      setType('lecture');
    }
    setErrors({});
  }, [initialData, defaultDay, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!subject.trim()) errs.subject = 'Subject name is required';
    if (!courseCode.trim()) errs.courseCode = 'Course code is required';
    if (!teacher.trim()) errs.teacher = 'Teacher name is required';
    if (!room.trim()) errs.room = 'Room / Lab is required';
    if (!startTime) errs.startTime = 'Start time is required';
    if (!endTime) errs.endTime = 'End time is required';

    if (startTime && endTime) {
      const sMin = timeToMinutes(startTime);
      const eMin = timeToMinutes(endTime);
      if (isNaN(sMin) || isNaN(eMin)) {
        errs.endTime = 'Invalid time format';
      } else if (eMin <= sMin) {
        errs.endTime = 'End time must be after start time';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...(initialData ? { id: initialData.id } : {}),
      section: 'CSE-15',
      day,
      subject: subject.trim(),
      courseCode: courseCode.trim().toUpperCase(),
      teacher: teacher.trim(),
      room: room.trim().toUpperCase(),
      startTime,
      endTime,
      batch: batch.trim() || undefined,
      type,
    };

    onSave(payload as any);
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="class-modal-title">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3 id="class-modal-title" className="modal-title">
            {isEditing ? 'Edit Class (CSE-15)' : 'Add New Class (CSE-15)'}
          </h3>
          <button
            type="button"
            className="btn-icon-action"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <XIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Subject Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="subject">
                Subject Name <span className="required">*</span>
              </label>
              <input
                id="subject"
                type="text"
                className="form-input"
                placeholder="e.g. Operating Systems"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              {errors.subject && (
                <div className="form-error-text">
                  <AlertCircleIcon size={13} /> {errors.subject}
                </div>
              )}
            </div>

            {/* Course Code & Type */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="courseCode">
                  Course Code <span className="required">*</span>
                </label>
                <input
                  id="courseCode"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 25CS302"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                />
                {errors.courseCode && (
                  <div className="form-error-text">
                    <AlertCircleIcon size={13} /> {errors.courseCode}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="type">
                  Class Type
                </label>
                <select
                  id="type"
                  className="form-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as ClassType)}
                >
                  <option value="lecture">Lecture</option>
                  <option value="lab">Lab</option>
                  <option value="workshop">Workshop</option>
                  <option value="skill">Skill</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Teacher & Room */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="teacher">
                  Teacher / Faculty <span className="required">*</span>
                </label>
                <input
                  id="teacher"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ms. Divya Maheswari"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                />
                {errors.teacher && (
                  <div className="form-error-text">
                    <AlertCircleIcon size={13} /> {errors.teacher}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="room">
                  Room / Lab <span className="required">*</span>
                </label>
                <input
                  id="room"
                  type="text"
                  className="form-input"
                  placeholder="e.g. KC-204 or Lab-5"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                />
                {errors.room && (
                  <div className="form-error-text">
                    <AlertCircleIcon size={13} /> {errors.room}
                  </div>
                )}
              </div>
            </div>

            {/* Day & Batch */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="day">
                  Day of Week <span className="required">*</span>
                </label>
                <select
                  id="day"
                  className="form-select"
                  value={day}
                  onChange={(e) => setDay(e.target.value as DayOfWeek)}
                >
                  {DAYS_LIST.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="batch">
                  Batch (Optional)
                </label>
                <input
                  id="batch"
                  type="text"
                  className="form-input"
                  placeholder="e.g. G1, G2, Batch-1"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                />
              </div>
            </div>

            {/* Start Time & End Time */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="startTime">
                  Start Time <span className="required">*</span>
                </label>
                <input
                  id="startTime"
                  type="time"
                  className="form-input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                {errors.startTime && (
                  <div className="form-error-text">
                    <AlertCircleIcon size={13} /> {errors.startTime}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="endTime">
                  End Time <span className="required">*</span>
                </label>
                <input
                  id="endTime"
                  type="time"
                  className="form-input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
                {errors.endTime && (
                  <div className="form-error-text">
                    <AlertCircleIcon size={13} /> {errors.endTime}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isEditing ? 'Save Changes' : 'Add Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
