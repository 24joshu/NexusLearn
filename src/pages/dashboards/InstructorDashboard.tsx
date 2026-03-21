import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Users, BookOpen, DollarSign, BarChart3, MoreVertical, GraduationCap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#4f46e5', '#818cf8', '#6366f1', '#4338ca', '#3730a3'];

export const InstructorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'courses'), where('instructorId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const totalStudents = courses.reduce((acc, curr) => acc + (curr.enrollmentCount || 0), 0);
  const chartData = courses.slice(0, 5).map(c => ({
    name: c.title.length > 15 ? c.title.substring(0, 12) + '...' : c.title,
    students: c.enrollmentCount || 0
  }));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold mb-2">Instructor Studio</h1>
          <p className="text-gray-400">Manage your courses and track student performance.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/student/dashboard')}
            className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all border border-white/10"
          >
            <GraduationCap className="w-5 h-5" />
            Student View
          </button>
          <button
            onClick={() => navigate('/instructor/courses')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-5 h-5" />
            Create New Course
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-indigo-600/20 text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalStudents.toLocaleString()}</div>
              <div className="text-gray-400 text-sm">Total Students</div>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-green-600/20 text-green-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">$0</div>
              <div className="text-gray-400 text-sm">Total Revenue</div>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{courses.length}</div>
              <div className="text-gray-400 text-sm">Active Courses</div>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-yellow-600/20 text-yellow-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">0.0</div>
              <div className="text-gray-400 text-sm">Avg. Rating</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-8 rounded-3xl bg-white/5 border border-white/10">
          <h3 className="text-xl font-bold mb-8">Enrollment by Course</h3>
          <div className="h-[300px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: '#ffffff05' }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  />
                  <Bar dataKey="students" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                No data available yet.
              </div>
            )}
          </div>
        </div>

        <div className="p-8 rounded-3xl bg-white/5 border border-white/10">
          <h3 className="text-xl font-bold mb-6">Recent Courses</h3>
          <div className="space-y-4">
            {courses.length > 0 ? (
              courses.slice(0, 4).map((course) => (
                <div
                  key={course.id}
                  onClick={() => navigate('/instructor/courses')}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600/20 flex items-center justify-center font-bold text-indigo-400 overflow-hidden">
                      {course.thumbnailUrl ? (
                        <img src={course.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        course.title.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="font-bold truncate max-w-[150px]">{course.title}</div>
                      <div className="text-xs text-gray-400">
                        {course.published ? 'Published' : 'Draft'} • {new Date(course.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-white/10 rounded-lg">
                    <MoreVertical className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No courses created yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
