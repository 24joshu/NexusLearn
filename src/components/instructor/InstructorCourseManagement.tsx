import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Eye, EyeOff, BookOpen, Edit2, ExternalLink } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import AddCourseModal from '../modals/AddCourseModal';

export const InstructorCourseManagement = () => {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    console.log('Initializing InstructorCourseManagement listener for UID:', user.uid);
    const q = query(
      collection(db, 'courses'),
      where('instructorId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Fetched ${snapshot.docs.length} instructor courses from Firestore`);
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Firestore onSnapshot error in InstructorCourseManagement:', error);
      setError(`Database error: ${error.message}. Please check your connection.`);
    });

    return () => unsubscribe();
  }, [user]);

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/courses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !currentStatus })
      });
    } catch (error) {
      console.error('Failed to toggle publish:', error);
    }
  };

  const deleteCourse = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      await fetch(`/api/courses/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete course:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">My Courses</h3>
          <p className="text-sm text-gray-400">Create and manage your educational content.</p>
        </div>
        <button
          onClick={() => {
            setEditingCourse(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-[0_0_20px_rgba(79,70,229,0.2)]"
        >
          <Plus className="w-5 h-5" />
          Create New Course
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden backdrop-blur-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs font-mono text-indigo-400 uppercase tracking-widest border-b border-white/10">
              <th className="p-6 font-medium">Course Title</th>
              <th className="p-6 font-medium">Students</th>
              <th className="p-6 font-medium">Status</th>
              <th className="p-6 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <BookOpen className="w-8 h-8 opacity-20" />
                    <p>You haven't created any courses yet.</p>
                  </div>
                </td>
              </tr>
            ) : (
              courses.map((course) => (
                <tr key={course.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-600/10 overflow-hidden border border-white/10">
                        <img src={course.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-lg">{course.title}</div>
                        <div className="text-xs text-gray-500 font-mono">{course.level || 'Beginner'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="text-white font-bold">{course.enrollmentCount || 0}</div>
                  </td>
                  <td className="p-6">
                    {course.published ? (
                      <div className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_#4ade80]" />
                        Active
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500 font-bold text-xs uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                        Draft
                      </div>
                    )}
                  </td>
                  <td className="p-6">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/courses/${course.id}`}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-indigo-400"
                        title="View Course"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => togglePublish(course.id, course.published)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-indigo-400"
                        title={course.published ? 'Unpublish' : 'Publish'}
                      >
                        {course.published ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => {
                          setEditingCourse(course);
                          setShowAddModal(true);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                        title="Edit"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteCourse(course.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <AddCourseModal 
            onClose={() => {
              setShowAddModal(false);
              setEditingCourse(null);
            }}
            initialInstructorName={profile?.displayName || user?.displayName || ''}
            instructorId={user?.uid}
            editingCourse={editingCourse}
            onAdd={(newCourse) => {
              setShowAddModal(false);
              setEditingCourse(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
