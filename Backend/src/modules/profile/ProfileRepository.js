import User from '../auth/User.js';

export class ProfileRepository {
  static findById(userId) {
    return User.findById(userId);
  }

  static findByIdWithPassword(userId) {
    return User.findById(userId).select('+password');
  }

  static async updateById(userId, updates) {
    return User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    });
  }

  static async save(user) {
    return user.save();
  }
}

export default ProfileRepository;
