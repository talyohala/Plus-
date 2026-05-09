import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { playSystemSound } from '../providers/AppManager';

interface ReportFormProps {
  buildingId: string;
  userId: string;
  userFullName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReportForm({ buildingId, userId, userFullName, onClose, onSuccess }: ReportFormProps) {
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildingId || (!description.trim() && !imageFile)) return;
    setIsSubmitting(true);

    let imageUrl: string | undefined = undefined;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('tickets').upload(fileName, imageFile);
      if (!error && data) {
        imageUrl = supabase.storage.from('tickets').getPublicUrl(fileName).data.publicUrl;
      }
    }

    let finalTitle = 'תקלה בבניין';
    let aiTags: string[] = [];

    try {
      const aiRes = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, mode: 'classify' }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        if (aiData.title) finalTitle = aiData.title;
        if (aiData.tags) aiTags = aiData.tags;
      }
    } catch (err) {
      finalTitle = description.trim().split(' ').slice(0, 4).join(' ') + '...';
    }

    const { error } = await supabase.from('service_tickets').insert([{
      building_id: buildingId,
      user_id: userId,
      title: finalTitle,
      description: description,
      image_url: imageUrl,
      ai_tags: aiTags,
      source: 'app',
      status: 'פתוח'
    }]);

    if (!error) {
      // שליחת התראה מסודרת למנהלי הוועד בבניין
      const { data: admins } = await supabase.from('profiles')
        .select('id')
        .eq('building_id', buildingId)
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const notifs = admins.map(admin => ({
          receiver_id: admin.id,
          sender_id: userId,
          type: 'system',
          title: 'תקלה חדשה דווחה 🛠️',
          content: `${userFullName} פתח קריאה: ${finalTitle}`,
          link: '/services'
        }));
        await supabase.from('notifications').insert(notifs);
      }
    }

    playSystemSound('notification');
    setDescription('');
    setImageFile(null);
    setImagePreview(null);
    setIsSubmitting(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-orange-100 rounded-[2rem] p-5 shadow-lg animate-in zoom-in-95" dir="rtl">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-black text-slate-800">מה קרה?</h3>
          <span className="bg-orange-50 text-orange-500 text-[9px] font-bold px-2 py-0.5 rounded-full">מערכת חכמה פעילה</span>
        </div>
        <button type="button" onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:text-slate-800 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <textarea
        autoFocus
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="תאר במילים שלך... המערכת כבר תבין למי להפנות את זה"
        className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none resize-none min-h-[100px] mb-3 text-slate-800 border border-gray-100 focus:border-orange-300 transition"
      />

      {imagePreview && (
        <div className="relative w-24 h-24 mb-3 rounded-xl overflow-hidden shadow-sm">
          <img src={imagePreview} className="w-full h-full object-cover" alt="תצוגה" />
          <button
            type="button"
            onClick={() => { setImagePreview(null); setImageFile(null); }}
            className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="bg-gray-50 border border-gray-100 text-gray-500 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          type="submit"
          disabled={isSubmitting || (!description.trim() && !imageFile)}
          className="flex-1 bg-orange-500 text-white font-bold rounded-2xl shadow-sm disabled:opacity-50 active:scale-95 transition"
        >
          {isSubmitting ? 'מעבד מידע...' : 'שליחה לוועד'}
        </button>
      </div>
    </form>
  );
}
