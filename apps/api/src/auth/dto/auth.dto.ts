import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto {
  @Transform(trimString)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty()
  email!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Tên đăng nhập phải có ít nhất 3 ký tự' })
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Tên đăng nhập chỉ được gồm chữ cái, số và dấu gạch dưới',
  })
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số',
  })
  password!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên hiển thị' })
  @MinLength(2, { message: 'Tên hiển thị phải có ít nhất 2 ký tự' })
  @MaxLength(100)
  displayName!: string;
}

export class LoginDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập email hoặc tên đăng nhập' })
  identifier!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  password!: string;
}

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Mật khẩu mới phải gồm chữ hoa, chữ thường và chữ số',
  })
  newPassword!: string;
}
