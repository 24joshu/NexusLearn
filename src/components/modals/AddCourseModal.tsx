import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import GlassPanel from '../ui/GlassPanel';

interface AddCourseModalProps {
  onClose: () => void;
  onAdd: (course: any) => void;
  initialInstructorName?: string;
  instructorId?: string;
  editingCourse?: any;
}

export default function AddCourseModal({ onClose, onAdd, initialInstructorName, instructorId, editingCourse }: AddCourseModalProps) {
  const [title, setTitle] = useState(editingCourse?.title || '');
  const [instructor, setInstructor] = useState(editingCourse?.instructor || initialInstructorName || '');
  const [difficulty, setDifficulty] = useState(editingCourse?.level || 'Beginner');
  const [description, setDescription] = useState(editingCourse?.description || '');
  const [content, setContent] = useState(editingCourse?.content || '');
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setThumbnail(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('instructor', instructor);
    formData.append('content', content);
    if (instructorId) {
      formData.append('instructorId', instructorId);
    }
    formData.append('level', difficulty);
    formData.append('description', description);
    if (file) {
      formData.append('pdf', file);
    }
    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }

    try {
      const url = editingCourse ? `/api/courses/${editingCourse.id}` : '/api/courses';
      const method = editingCourse ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${editingCourse ? 'update' : 'create'} course`);
      }

      const data = await response.json();
      
      onAdd({
        id: editingCourse ? editingCourse.id : data.courseId,
        title,
        instructor,
        level: difficulty,
        description,
        content,
        enrollmentCount: editingCourse?.enrollmentCount || 0,
        published: editingCourse?.published || false,
        thumbnailUrl: thumbnail ? URL.createObjectURL(thumbnail) : (editingCourse?.thumbnailUrl || `https://picsum.photos/seed/${title.replace(/\s+/g, '').toLowerCase()}/800/600`),
      });
      onClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || `Failed to ${editingCourse ? 'update' : 'upload'} course. Please try again.`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl my-auto"
      >
        <GlassPanel className="relative border-neonBlue/30">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>

          <h2 className="text-3xl font-bold mb-8">{editingCourse ? 'Edit Course' : 'Add New Course'}</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-mono text-neonBlue uppercase tracking-widest">Course Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-neonBlue/50"
                  placeholder="e.g. Advanced Quantum Computing"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-neonBlue uppercase tracking-widest">Instructor Name</label>
                <input
                  type="text"
                  value={instructor}
                  onChange={(e) => setInstructor(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-neonBlue/50"
                  placeholder="Dr. Jane Smith"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-neonBlue uppercase tracking-widest">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-neonBlue/50 h-24 resize-none"
                placeholder="Briefly describe the course..."
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-neonBlue uppercase tracking-widest">Course Content (Markdown)</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-neonBlue/50 h-32 resize-none"
                placeholder="Detailed course content..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-neonBlue uppercase tracking-widest">Difficulty Level</label>
              <div className="flex gap-4">
                {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`flex-1 py-3 rounded-xl border transition-all font-bold text-sm ${difficulty === level
                        ? 'bg-neonBlue/20 border-neonBlue text-neonBlue'
                        : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/30'
                      }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-mono text-neonBlue uppercase tracking-widest">Course Materials (PDF)</label>
                <input
                  type="file"
                  id="course-file"
                  className="hidden"
                  accept=".pdf"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="course-file"
                  className="border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:border-neonBlue/30 cursor-pointer transition-colors group h-32"
                >
                  {file ? (
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle className="text-neonGreen w-6 h-6" />
                      <p className="text-neonGreen font-bold text-xs truncate max-w-[150px]">{file.name}</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="text-gray-500 group-hover:text-neonBlue w-6 h-6" />
                      <p className="text-white font-bold text-xs">Select PDF</p>
                    </>
                  )}
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono text-neonBlue uppercase tracking-widest">Thumbnail Image</label>
                <input
                  type="file"
                  id="thumbnail-file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                />
                <label
                  htmlFor="thumbnail-file"
                  className="border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:border-neonBlue/30 cursor-pointer transition-colors group h-32"
                >
                  {thumbnail ? (
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle className="text-neonGreen w-6 h-6" />
                      <p className="text-neonGreen font-bold text-xs truncate max-w-[150px]">{thumbnail.name}</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="text-gray-500 group-hover:text-neonBlue w-6 h-6" />
                      <p className="text-white font-bold text-xs">Select Image</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="w-full py-4 bg-neonBlue text-black font-bold rounded-xl hover:bg-white transition-all shadow-[0_0_30px_rgba(0,212,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (editingCourse ? 'Updating...' : 'Creating Course...') : (editingCourse ? 'Update Course' : 'Create Course')}
            </button>
          </form>
        </GlassPanel>
      </motion.div>
    </div>
  );
}
