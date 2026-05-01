import { useState, useEffect } from 'react';
import { Plus, Edit2, Check, X, User } from 'lucide-react';
import { getProfiles, createProfile, updateProfile, deleteProfile } from '../services/supabase';
import { xtreamService } from '../services/xtream';

interface Profile {
  id: string;
  profile_name: string;
  avatar_url: string;
}

interface ProfileSelectionProps {
  onSelect: (profile: Profile) => void;
}

const AVATARS = [
  'https://img.freepik.com/free-vector/cute-fox-sitting-cartoon-vector-icon-illustration_138676-4148.jpg',
  'https://img.freepik.com/free-vector/cute-panda-with-bamboo-cartoon-vector-icon-illustration_138676-3642.jpg',
  'https://img.freepik.com/free-vector/cute-lion-king-cartoon-vector-icon-illustration_138676-3539.jpg',
  'https://img.freepik.com/free-vector/cute-koala-sleeping-tree-cartoon-vector-icon-illustration_138676-3641.jpg',
  'https://img.freepik.com/free-vector/cute-penguin-floating-with-balloon-cartoon-vector-icon-illustration_138676-3634.jpg',
  'https://img.freepik.com/free-vector/cute-elephant-sitting-cartoon-vector-icon-illustration_138676-3640.jpg',
];

export const ProfileSelection = ({ onSelect }: ProfileSelectionProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState(AVATARS[0]);

  const username = xtreamService.getCredentials()?.username || 'guest';

  useEffect(() => {
    loadProfiles();
  }, [username]);

  const loadProfiles = async () => {
    try {
      const data = await getProfiles(username);
      setProfiles(data || []);
    } catch (err) {
      console.error('Error loading profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProfile = async () => {
    if (!newName.trim()) return;
    try {
      await createProfile({
        username,
        profile_name: newName,
        avatar_url: newAvatar
      });
      setShowAddModal(false);
      setNewName('');
      loadProfiles();
    } catch (err) {
      console.error('Error adding profile:', err);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editingProfile || !newName.trim()) return;
    try {
      await updateProfile(editingProfile.id, {
        profile_name: newName,
        avatar_url: newAvatar
      });
      setEditingProfile(null);
      setNewName('');
      loadProfiles();
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!window.confirm('Excluir este perfil?')) return;
    try {
      await deleteProfile(id);
      loadProfiles();
    } catch (err) {
      console.error('Error deleting profile:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans">
      <h1 className="text-4xl md:text-5xl font-bold mb-12 tracking-tight">Quem está assistindo?</h1>
      
      <div className="flex flex-wrap justify-center gap-8 max-w-5xl">
        {profiles.map((profile) => (
          <div key={profile.id} className="group relative flex flex-col items-center gap-4">
            <button
              onClick={() => isEditing ? (setEditingProfile(profile), setNewName(profile.profile_name), setNewAvatar(profile.avatar_url)) : onSelect(profile)}
              className="relative w-32 h-32 md:w-40 md:h-40 rounded-lg overflow-hidden transition-all duration-300 group-hover:ring-4 group-hover:ring-white group-hover:scale-105"
            >
              <img src={profile.avatar_url} alt={profile.profile_name} className="w-full h-full object-cover" />
              {isEditing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Edit2 size={32} className="text-white" />
                </div>
              )}
            </button>
            <span className="text-zinc-400 group-hover:text-white transition-colors text-lg font-medium">{profile.profile_name}</span>
            {isEditing && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }}
                className="absolute -top-2 -right-2 bg-red-600 p-1 rounded-full hover:scale-110 transition-all"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}

        {profiles.length < 5 && !isEditing && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-32 h-32 md:w-40 md:h-40 rounded-lg bg-zinc-900 flex items-center justify-center hover:bg-zinc-800 transition-all group"
            >
              <Plus size={64} className="text-zinc-600 group-hover:text-white transition-colors" />
            </button>
            <span className="text-zinc-500 text-lg font-medium">Adicionar Perfil</span>
          </div>
        )}
      </div>

      <button
        onClick={() => setIsEditing(!isEditing)}
        className="mt-16 px-8 py-2 border border-zinc-600 text-zinc-600 hover:text-white hover:border-white transition-all uppercase tracking-[0.2em] text-sm"
      >
        {isEditing ? 'Concluído' : 'Gerenciar Perfis'}
      </button>

      {/* Modal Add/Edit */}
      {(showAddModal || editingProfile) && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#141414] rounded-2xl p-8 max-w-md w-full border border-white/10 shadow-2xl">
            <h2 className="text-2xl font-bold mb-8">{editingProfile ? 'Editar Perfil' : 'Adicionar Perfil'}</h2>
            
            <div className="flex flex-col gap-8">
              <div className="flex justify-center gap-4 flex-wrap">
                {AVATARS.map((url) => (
                  <button
                    key={url}
                    onClick={() => setNewAvatar(url)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-4 transition-all ${newAvatar === url ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  >
                    <img src={url} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do perfil"
                className="bg-zinc-800 border-none text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-white transition-all text-lg"
                autoFocus
              />

              <div className="flex gap-4">
                <button
                  onClick={editingProfile ? handleUpdateProfile : handleAddProfile}
                  className="flex-1 bg-white text-black font-bold py-3 rounded-lg hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={20} />
                  Salvar
                </button>
                <button
                  onClick={() => { setShowAddModal(false); setEditingProfile(null); setNewName(''); }}
                  className="flex-1 bg-zinc-800 text-white font-bold py-3 rounded-lg hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                >
                  <X size={20} />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
