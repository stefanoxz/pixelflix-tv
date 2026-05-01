import { ReactNode } from 'react';

interface AdminCardProps {
  title: string;
  icon: ReactNode;
  iconColorClass: string;
  children: ReactNode;
}

export const AdminCard = ({ title, icon, iconColorClass, children }: AdminCardProps) => {
  return (
    <div className="bg-[#0A0A0A] border border-white/5 rounded-[40px] p-10 space-y-8">
      <div className={`w-16 h-16 rounded-[24px] ${iconColorClass} flex items-center justify-center border border-white/5 shadow-xl`}>
        {icon}
      </div>
      <div className="space-y-4">
        <h3 className="text-xl font-black">{title}</h3>
        {children}
      </div>
    </div>
  );
};
