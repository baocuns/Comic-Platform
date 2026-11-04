'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import {
  cultivationApi,
  ShopItem,
  OwnedItem,
  InventoryResponse,
} from '@/lib/cultivation-api';
import { CultivationNav } from '@/components/cultivation/cultivation-nav';

export default function CultivationInventoryPage() {
  const { accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'shop' | 'backpack'>('shop');
  const [loading, setLoading] = useState(true);
  const [inventoryData, setInventoryData] = useState<InventoryResponse['data'] | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadInventory = async () => {
    if (!accessToken) return;
    try {
      const res = await cultivationApi.getInventory(accessToken);
      if (res.success) {
        setInventoryData(res.data);
      }
    } catch (err) {
      console.error('Lỗi tải túi trữ vật:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [accessToken]);

  const handleRedeem = async (itemId: string) => {
    if (!accessToken) {
      showToast('Đạo hữu cần đăng nhập để đổi vật phẩm!', 'error');
      return;
    }

    setRedeemingId(itemId);
    try {
      const res = await cultivationApi.redeemItem(itemId, accessToken);
      if (res.success) {
        showToast(res.message, 'success');
        loadInventory();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Có lỗi xảy ra khi đổi vật phẩm', 'error');
    } finally {
      setRedeemingId(null);
    }
  };

  const coinsBalance = inventoryData?.coins ?? 3250;
  const shopItems: ShopItem[] = inventoryData?.shopItems ?? [
    {
      id: 'vip_chapter_pass',
      name: 'Thẻ Khóa Chương VIP',
      category: 'Thẻ Đặc Quyền',
      price: 50,
      icon: 'ticket',
      description: 'Mở khóa 1 chương truyện khóa VIP bất kỳ vĩnh viễn',
      badge: 'PHỔ BIẾN',
    },
    {
      id: 'breakthrough_pill',
      name: 'Đan Dược Đột Phá Hộ Thể',
      category: 'Đan Dược',
      price: 150,
      icon: 'flask-round-potion',
      description: 'Tăng 100% tỷ lệ đột phá thành công, phòng tránh tẩu hỏa nhập ma',
      badge: 'QUÝ HIẾM',
    },
    {
      id: 'avatar_frame_gold',
      name: 'Khung Kim Đan Huyễn Ảo',
      category: 'Trang Trí',
      price: 300,
      icon: 'palette',
      description: 'Khung đại diện viền vàng rực rỡ độc bản 30 ngày',
      badge: 'ĐỘC QUYỀN',
    },
    {
      id: 'exp_boost_24h',
      name: 'Thẻ Nhân Đôi EXP 24h',
      category: 'Phụ Trợ',
      price: 80,
      icon: 'bolt-lightning',
      description: 'Nhân đôi toàn bộ EXP nhận được khi đọc truyện trong 24 giờ',
      badge: 'HOT',
    },
    {
      id: 'rename_token',
      name: 'Thẻ Đổi Đạo Hiệu',
      category: 'Đặc Quyền',
      price: 100,
      icon: 'signature',
      description: 'Đổi tên hiển thị / đạo hiệu của bạn trên toàn hệ thống OWOC',
      badge: 'TIỆN ÍCH',
    },
    {
      id: 'author_flower',
      name: 'Hoa Tươi Tặng Tác Giả',
      category: 'Ủng Hộ',
      price: 20,
      icon: 'flower',
      description: 'Tặng hoa ủng hộ tác giả yêu thích, tăng độ hảo cảm',
      badge: 'TƯƠNG TÁC',
    },
  ];

  const ownedItems: OwnedItem[] = inventoryData?.ownedItems ?? [
    {
      id: 'vip_chapter_pass',
      name: 'Thẻ Khóa Chương VIP',
      category: 'Thẻ Đặc Quyền',
      price: 50,
      icon: 'ticket',
      description: 'Mở khóa 1 chương truyện khóa VIP bất kỳ vĩnh viễn',
      badge: 'SỞ HỮU',
      count: 3,
    },
    {
      id: 'breakthrough_pill',
      name: 'Đan Dược Đột Phá Hộ Thể',
      category: 'Đan Dược',
      price: 150,
      icon: 'flask-round-potion',
      description: 'Tăng 100% tỷ lệ đột phá thành công',
      badge: 'SỞ HỮU',
      count: 1,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FCF9F8] dark:bg-[#0c0d0e] text-[#1B1C1C] dark:text-[#E4E2E1] font-sans antialiased pb-20">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl transition-all animate-bounce ${
            toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          <i className={`fa-solid ${toastMessage.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} text-lg`} />
          <span className="text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Sub-Navigation Bar */}
      <CultivationNav coins={coinsBalance} />

      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Header Hero Card: Linh Thạch & Bổng Lộc */}
        <div className="bg-gradient-to-r from-orange-500 via-[#FF7A1A] to-amber-500 rounded-2xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 text-center md:text-left z-10">
            <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
              Túi Càn Khôn • Tiên Gia Bảo Khố
            </span>
            <h1 className="text-2xl sm:text-3xl font-black">
              Túi Trữ Vật & Tiệm Linh Thạch OWOC
            </h1>
            <p className="text-xs sm:text-sm text-white/90 max-w-xl">
              Linh Thạch dùng để đổi đan dược đột phá, mở khóa chương VIP độc bản, và các trang sức đạo pháp lộng lẫy.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl text-center shrink-0 min-w-[200px] z-10">
            <span className="text-xs text-white/80 font-medium block">Số Dư Hiện Tại</span>
            <span className="text-3xl font-black block my-1">
              {coinsBalance.toLocaleString()}
            </span>
            <span className="text-xs font-bold bg-white text-[#FF7A1A] px-3 py-0.5 rounded-full inline-block">
              Linh Thạch
            </span>
          </div>
        </div>

        {/* Tab switch: Tiệm Tiên Bảo vs Túi Đồ Của Tôi */}
        <div className="flex gap-2 border-b border-zinc-200 dark:border-white/10 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'shop'
                ? 'bg-[#FF7A1A] text-white shadow-sm'
                : 'bg-white dark:bg-[#141516] text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-white/10'
            }`}
          >
            <i className="fa-solid fa-store" />
            <span>Tiệm Đan Dược & Tiên Bảo ({shopItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backpack')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'backpack'
                ? 'bg-[#FF7A1A] text-white shadow-sm'
                : 'bg-white dark:bg-[#141516] text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-white/10'
            }`}
          >
            <i className="fa-solid fa-sack-dollar" />
            <span>Túi Trữ Vật Của Tôi ({ownedItems.length})</span>
          </button>
        </div>

        {/* Tab 1: Tiệm Tiên Bảo */}
        {activeTab === 'shop' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shopItems.map((item) => {
              const canAfford = coinsBalance >= item.price;
              const isBuying = redeemingId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#141516] p-5 rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between hover:border-[#FF7A1A]/50 transition-all space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A] flex items-center justify-center text-xl shrink-0">
                        <i className={`fa-solid fa-${item.icon || 'box'}`} />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#FF7A1A] text-[10px] font-extrabold">
                        {item.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{item.name}</h3>
                      <span className="text-[11px] text-zinc-400">{item.category}</span>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
                    <span className="text-base font-black text-[#FF7A1A]">
                      {item.price} <span className="text-xs font-normal text-zinc-500">Linh Thạch</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRedeem(item.id)}
                      disabled={isBuying || !canAfford}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        canAfford
                          ? 'bg-[#FF7A1A] hover:bg-[#E85D04] text-white shadow-sm active:scale-95'
                          : 'bg-zinc-100 dark:bg-white/5 text-zinc-400 cursor-not-allowed'
                      }`}
                    >
                      <i className="fa-solid fa-cart-shopping" />
                      <span>{isBuying ? 'Đang Đổi...' : canAfford ? 'Đổi Ngay' : 'Không Đủ Thạch'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Túi Trữ Vật Của Tôi */}
        {activeTab === 'backpack' && (
          <div className="space-y-4">
            {ownedItems.length === 0 ? (
              <div className="bg-white dark:bg-[#141516] p-12 rounded-2xl border border-zinc-200/80 dark:border-white/10 text-center space-y-3">
                <i className="fa-solid fa-box-open text-4xl text-zinc-300 dark:text-zinc-600" />
                <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-300">
                  Túi trữ vật hiện đang trống
                </h3>
                <p className="text-xs text-zinc-400">
                  Đạo hữu có thể dùng Linh Thạch để đổi các vật phẩm độc bản tại Tiệm Tiên Bảo
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('shop')}
                  className="px-4 py-2 rounded-xl bg-[#FF7A1A] text-white text-xs font-bold"
                >
                  Ghé Thăm Tiệm Tiên Bảo
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-[#141516] p-5 rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                          <i className={`fa-solid fa-${item.icon || 'box'}`} />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 text-xs font-extrabold">
                          Số lượng: {item.count}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{item.name}</h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Sẵn sàng sử dụng</span>
                      <button
                        type="button"
                        onClick={() => showToast(`Đã áp dụng vật phẩm "${item.name}" thành công!`, 'success')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        Sử Dụng
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

